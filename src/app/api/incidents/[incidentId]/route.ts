import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  findNearbyEligibleVolunteers,
  getDataContext,
  sanitizeIncidentForVolunteer,
  writeAuditLog,
} from "@/lib/data-access";
import { formatApproxDistance } from "@/lib/geo";
import { syncTelegramUpdatesIfLocal } from "@/lib/telegram-updates";
import {
  DEMO_LOCATION_PRESETS,
  type IncidentDoc,
  type IncidentNotificationDoc,
  type VolunteerDoc,
} from "@/lib/types";

async function loadIncident(incidentId: string) {
  const ctx = await getDataContext();
  let incident: IncidentDoc | null = null;
  let notifications: IncidentNotificationDoc[] = [];

  if (ctx.db) {
    incident = await ctx.db
      .collection<IncidentDoc>("incidents")
      .findOne({ incidentId });
    notifications = await ctx.db
      .collection<IncidentNotificationDoc>("incidentNotifications")
      .find({ incidentId })
      .toArray();
  } else if (ctx.fallback) {
    incident =
      ctx.fallback.incidents.find((i) => i.incidentId === incidentId) || null;
    notifications = ctx.fallback.incidentNotifications.filter(
      (n) => n.incidentId === incidentId
    );
  }

  return { ctx, incident, notifications };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ incidentId: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  await syncTelegramUpdatesIfLocal();

  const { incidentId } = await params;
  const { ctx, incident, notifications } = await loadIncident(incidentId);

  if (!incident) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }

  if (user.role === "volunteer") {
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
        {
          error:
            "Only verified volunteers can view incident alert details.",
        },
        { status: 403 }
      );
    }

    const myNotification = notifications.find(
      (n) => n.volunteerId === volunteer._id
    );
    if (!myNotification) {
      return NextResponse.json(
        {
          error:
            "You were not dispatched to this incident alert.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      incident: sanitizeIncidentForVolunteer(incident),
      myNotification: {
        ...myNotification,
        approxDistanceText: formatApproxDistance(myNotification.distanceMeters),
      },
      dbMode: ctx.mode,
      dbNotice: ctx.notice,
    });
  }

  const [lng, lat] = incident.incidentLocation.coordinates.coordinates;
  const eligibleVolunteers = await findNearbyEligibleVolunteers(lng, lat);

  return NextResponse.json({
    incident,
    notifications,
    eligibleVolunteers: eligibleVolunteers.map((v) => ({
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
    dbMode: ctx.mode,
    dbNotice: ctx.notice,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ incidentId: string }> }
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "operator" && user.role !== "admin")) {
    return NextResponse.json(
      { error: "Operator or Admin access required." },
      { status: 403 }
    );
  }

  const { incidentId } = await params;
  const { ctx, incident } = await loadIncident(incidentId);
  if (!incident) {
    return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  }

  const body = (await request.json()) as {
    action?: "confirm" | "false_positive" | "close" | "update_location";
    areaPresetId?: string;
    areaName?: string;
    approxLabel?: string;
    lng?: number;
    lat?: number;
  };

  const now = new Date().toISOString();
  const updates: Partial<IncidentDoc> = { updatedAt: now };

  if (body.action === "confirm") {
    updates.confirmationStatus = "confirmed";
  } else if (body.action === "false_positive") {
    updates.confirmationStatus = "false_positive";
    updates.incidentStatus = "closed";
  } else if (body.action === "close") {
    updates.incidentStatus = "closed";
  } else if (body.action === "update_location") {
    const preset = DEMO_LOCATION_PRESETS.find(
      (p) => p.id === body.areaPresetId
    );
    const areaName =
      body.areaName?.trim() ||
      preset?.areaName ||
      incident.incidentLocation.areaName;
    const approxLabel =
      body.approxLabel?.trim() ||
      preset?.approxLabel ||
      incident.incidentLocation.approxLabel;
    const lng =
      typeof body.lng === "number" && Number.isFinite(body.lng)
        ? body.lng
        : preset?.lng ?? incident.incidentLocation.coordinates.coordinates[0];
    const lat =
      typeof body.lat === "number" && Number.isFinite(body.lat)
        ? body.lat
        : preset?.lat ?? incident.incidentLocation.coordinates.coordinates[1];

    updates.incidentLocation = {
      areaName,
      approxLabel,
      coordinates: {
        type: "Point",
        coordinates: [lng, lat],
      },
    };
  } else {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  if (ctx.db) {
    await ctx.db
      .collection<IncidentDoc>("incidents")
      .updateOne({ incidentId }, { $set: updates });
  } else if (ctx.fallback) {
    Object.assign(incident, updates);
  }

  const updatedIncident = { ...incident, ...updates };
  const [lng, lat] = updatedIncident.incidentLocation.coordinates.coordinates;
  const eligibleVolunteers = await findNearbyEligibleVolunteers(lng, lat);

  await writeAuditLog({
    actorId: user.userId,
    actorRole: user.role,
    action: `INCIDENT_${(body.action || "update").toUpperCase()}`,
    resourceType: "incident",
    resourceId: incidentId,
    relevantMetadata: { updates },
  });

  return NextResponse.json({
    incident: updatedIncident,
    eligibleVolunteers: eligibleVolunteers.map((v) => ({
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
  });
}
