import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
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
  type VolunteerApplicationDoc,
  type VolunteerDoc,
} from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "volunteer") {
    return NextResponse.json(
      { error: "Volunteer session required." },
      { status: 403 }
    );
  }

  await syncTelegramUpdatesIfLocal();

  const ctx = await getDataContext();
  let volunteer: VolunteerDoc | null = null;
  let application: VolunteerApplicationDoc | null = null;
  let notifications: IncidentNotificationDoc[] = [];
  let incidents: IncidentDoc[] = [];

  if (ctx.db) {
    volunteer = await ctx.db
      .collection<VolunteerDoc>("volunteers")
      .findOne({ userId: user.userId });
    application = await ctx.db
      .collection<VolunteerApplicationDoc>("volunteerApplications")
      .findOne({ userId: user.userId });
    if (volunteer) {
      notifications = await ctx.db
        .collection<IncidentNotificationDoc>("incidentNotifications")
        .find({ volunteerId: volunteer._id })
        .sort({ notificationSentAt: -1 })
        .toArray();
    }
    const incIds = notifications.map((n) => n.incidentId);
    if (incIds.length > 0) {
      incidents = await ctx.db
        .collection<IncidentDoc>("incidents")
        .find({ incidentId: { $in: incIds } })
        .toArray();
    }
  } else if (ctx.fallback) {
    volunteer =
      ctx.fallback.volunteers.find((v) => v.userId === user.userId) || null;
    application =
      ctx.fallback.volunteerApplications.find(
        (a) => a.userId === user.userId
      ) || null;
    if (volunteer) {
      notifications = ctx.fallback.incidentNotifications.filter(
        (n) => n.volunteerId === volunteer!._id
      );
      incidents = ctx.fallback.incidents;
    }
  }

  const enrichedNotifications = notifications.map((n) => {
    const inc = incidents.find((i) => i.incidentId === n.incidentId);
    return {
      ...n,
      approxDistanceText: formatApproxDistance(n.distanceMeters),
      incident: inc ? sanitizeIncidentForVolunteer(inc) : null,
    };
  });

  return NextResponse.json({
    user,
    volunteer,
    application,
    notifications: enrichedNotifications,
    dbMode: ctx.mode,
    dbNotice: ctx.notice,
  });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "volunteer") {
    return NextResponse.json(
      { error: "Volunteer session required." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as {
    areaPresetId?: string;
    registeredArea?: string;
    lng?: number;
    lat?: number;
    documentName?: string;
    documentLabel?: string;
    documentSizeBytes?: number;
    telegramChatId?: string;
  };

  const ctx = await getDataContext();
  const now = new Date().toISOString();

  let volunteer: VolunteerDoc | null = null;
  if (ctx.db) {
    volunteer = await ctx.db
      .collection<VolunteerDoc>("volunteers")
      .findOne({ userId: user.userId });
  } else if (ctx.fallback) {
    volunteer =
      ctx.fallback.volunteers.find((v) => v.userId === user.userId) || null;
  }

  if (!volunteer) {
    return NextResponse.json(
      { error: "Volunteer profile not found." },
      { status: 404 }
    );
  }

  const updates: Partial<VolunteerDoc> = { updatedAt: now };
  if (body.areaPresetId || (body.lng !== undefined && body.lat !== undefined)) {
    const preset = DEMO_LOCATION_PRESETS.find(
      (p) => p.id === body.areaPresetId
    );
    const registeredArea =
      body.registeredArea?.trim() ||
      preset?.areaName ||
      volunteer.registeredArea;
    const lng =
      typeof body.lng === "number" && Number.isFinite(body.lng)
        ? body.lng
        : preset?.lng ?? volunteer.registeredLocation.coordinates[0];
    const lat =
      typeof body.lat === "number" && Number.isFinite(body.lat)
        ? body.lat
        : preset?.lat ?? volunteer.registeredLocation.coordinates[1];

    updates.registeredArea = registeredArea;
    updates.registeredLocation = {
      type: "Point",
      coordinates: [lng, lat],
    };
  }

  if (typeof body.telegramChatId === "string") {
    const cleaned = body.telegramChatId.trim();
    updates.telegramChatId = cleaned || null;
  }

  if (ctx.db) {
    await ctx.db
      .collection<VolunteerDoc>("volunteers")
      .updateOne({ userId: user.userId }, { $set: updates });
  } else if (ctx.fallback) {
    Object.assign(volunteer, updates);
  }

  if (body.documentName?.trim()) {
    const newDocRef = {
      docId: `doc-${Date.now()}`,
      label:
        body.documentLabel?.trim() ||
        "Demo Volunteer Verification Document Placeholder",
      fileName: body.documentName.trim(),
      mimeType: "application/octet-stream",
      sizeBytes: Math.max(128, Number(body.documentSizeBytes || 1024)),
      uploadedAt: now,
      isDemoPlaceholder: true,
    };

    if (ctx.db) {
      await ctx.db
        .collection<VolunteerApplicationDoc>("volunteerApplications")
        .updateOne(
          { userId: user.userId },
          {
            $push: { documentReferences: newDocRef },
            $set: {
              applicationStatus:
                volunteer.verificationStatus === "Rejected"
                  ? "Submitted"
                  : volunteer.verificationStatus,
            },
          }
        );
    } else if (ctx.fallback) {
      const app = ctx.fallback.volunteerApplications.find(
        (a) => a.userId === user.userId
      );
      if (app) {
        app.documentReferences.push(newDocRef);
      }
    }
  }

  await writeAuditLog({
    actorId: user.userId,
    actorRole: "volunteer",
    action: "VOLUNTEER_PROFILE_UPDATED",
    resourceType: "volunteer",
    resourceId: volunteer._id,
    relevantMetadata: {
      updatedArea: updates.registeredArea || null,
      uploadedDoc: body.documentName || null,
    },
  });

  return NextResponse.json({
    ok: true,
    volunteer: { ...volunteer, ...updates },
  });
}
