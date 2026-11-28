import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDataContext, writeAuditLog } from "@/lib/data-access";
import type {
  IncidentDoc,
  IncidentNotificationDoc,
  VolunteerDoc,
} from "@/lib/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ incidentId: string }> }
) {
  const user = await getSessionUser();
  if (!user || user.role !== "volunteer") {
    return NextResponse.json(
      { error: "Verified volunteer session required." },
      { status: 403 }
    );
  }

  const { incidentId } = await params;
  const body = (await request.json()) as {
    decision?: "accepted" | "declined";
  };

  if (body.decision !== "accepted" && body.decision !== "declined") {
    return NextResponse.json(
      { error: "Decision must be 'accepted' or 'declined'." },
      { status: 400 }
    );
  }

  const ctx = await getDataContext();
  let volunteer: VolunteerDoc | null = null;
  if (ctx.db) {
    volunteer = await ctx.db
      .collection<VolunteerDoc>("volunteers")
      .findOne({ userId: user.userId });
  } else if (ctx.fallback) {
    volunteer =
      ctx.fallback.volunteers.find((v) => v.userId === user.userId) || null;
  }

  if (!volunteer || volunteer.verificationStatus !== "Verified") {
    return NextResponse.json(
      { error: "Only verified volunteers can respond to alerts." },
      { status: 403 }
    );
  }

  const now = new Date().toISOString();

  if (ctx.db) {
    const res = await ctx.db
      .collection<IncidentNotificationDoc>("incidentNotifications")
      .updateOne(
        { incidentId, volunteerId: volunteer._id },
        {
          $set: {
            acknowledgementStatus: body.decision,
            acknowledgedAt: now,
          },
        }
      );
    if (res.matchedCount === 0) {
      return NextResponse.json(
        { error: "Alert notification record not found for your account." },
        { status: 404 }
      );
    }
    if (body.decision === "accepted") {
      await ctx.db
        .collection<IncidentDoc>("incidents")
        .updateOne(
          { incidentId, incidentStatus: { $in: ["open", "dispatched"] } },
          { $set: { incidentStatus: "acknowledged", updatedAt: now } }
        );
    }
  } else if (ctx.fallback) {
    const notif = ctx.fallback.incidentNotifications.find(
      (n) => n.incidentId === incidentId && n.volunteerId === volunteer!._id
    );
    if (!notif) {
      return NextResponse.json(
        { error: "Alert notification record not found for your account." },
        { status: 404 }
      );
    }
    notif.acknowledgementStatus = body.decision;
    notif.acknowledgedAt = now;
    if (body.decision === "accepted") {
      const inc = ctx.fallback.incidents.find(
        (i) => i.incidentId === incidentId
      );
      if (
        inc &&
        (inc.incidentStatus === "open" || inc.incidentStatus === "dispatched")
      ) {
        inc.incidentStatus = "acknowledged";
        inc.updatedAt = now;
      }
    }
  }

  await writeAuditLog({
    actorId: user.userId,
    actorRole: "volunteer",
    action:
      body.decision === "accepted"
        ? "VOLUNTEER_ACCEPTED_ALERT"
        : "VOLUNTEER_DECLINED_ALERT",
    resourceType: "incident",
    resourceId: incidentId,
    relevantMetadata: { volunteerId: volunteer._id },
  });

  return NextResponse.json({
    ok: true,
    decision: body.decision,
    acknowledgedAt: now,
  });
}
