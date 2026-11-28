import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  findNearbyEligibleVolunteers,
  getDataContext,
} from "@/lib/data-access";
import { formatApproxDistance } from "@/lib/geo";
import type { VolunteerDoc } from "@/lib/types";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || (user.role !== "operator" && user.role !== "admin")) {
    return NextResponse.json(
      { error: "Operator or Admin access required." },
      { status: 403 }
    );
  }

  const url = new URL(request.url);
  const lng = Number(url.searchParams.get("lng") ?? 77.6408);
  const lat = Number(url.searchParams.get("lat") ?? 12.9784);
  const maxDistance = Number(url.searchParams.get("maxDistance") ?? 10000);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return NextResponse.json(
      { error: "Valid lng and lat coordinates required." },
      { status: 400 }
    );
  }

  const eligible = await findNearbyEligibleVolunteers(lng, lat, maxDistance);

  // Also count unverified/ineligible in system for transparency (never eligible for dispatch)
  const ctx = await getDataContext();
  let unverifiedCount = 0;
  if (ctx.db) {
    unverifiedCount = await ctx.db
      .collection<VolunteerDoc>("volunteers")
      .countDocuments({
        $or: [
          { verificationStatus: { $ne: "Verified" } },
          { alertEligible: false },
        ],
      });
  } else if (ctx.fallback) {
    unverifiedCount = ctx.fallback.volunteers.filter(
      (v) => v.verificationStatus !== "Verified" || !v.alertEligible
    ).length;
  }

  return NextResponse.json({
    queryLocation: { lng, lat, maxDistanceMeters: maxDistance },
    eligibleVolunteers: eligible.map((v) => ({
      _id: v._id,
      displayName: v.displayName,
      registeredArea: v.registeredArea,
      verificationStatus: v.verificationStatus,
      alertEligible: v.alertEligible,
      telegramLinked: Boolean(v.telegramChatId),
      distanceMeters: v.distanceMeters,
      approxDistanceText: formatApproxDistance(v.distanceMeters),
      isSimulatedDemo: v.isSimulatedDemo,
    })),
    excludedUnverifiedCount: unverifiedCount,
    dbMode: ctx.mode,
    dbNotice: ctx.notice,
  });
}
