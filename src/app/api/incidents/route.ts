import { NextResponse } from "next/server";
import { getSessionUser, verifyAiServiceSecret } from "@/lib/auth";
import {
  getDataContext,
  persistFallbackStore,
  sanitizeIncidentForVolunteer,
  writeAuditLog,
} from "@/lib/data-access";
import {
  AUTO_DISPATCH_RISK_THRESHOLD,
  dispatchIncidentAlerts,
} from "@/lib/dispatch";
import { syncTelegramUpdatesIfLocal } from "@/lib/telegram-updates";
import {
  DEMO_LOCATION_PRESETS,
  INCIDENT_TYPE_LABELS,
  type IncidentDoc,
  type IncidentNotificationDoc,
  type IncidentType,
  type VolunteerDoc,
} from "@/lib/types";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  await syncTelegramUpdatesIfLocal();

  const url = new URL(request.url);
  const typeFilter = url.searchParams.get("type")?.trim();
  const statusFilter = url.searchParams.get("status")?.trim();
  const search = url.searchParams.get("q")?.trim().toLowerCase();

  const ctx = await getDataContext();

  let incidents: IncidentDoc[] = [];
  let notifications: IncidentNotificationDoc[] = [];

  if (ctx.db) {
    incidents = await ctx.db
      .collection<IncidentDoc>("incidents")
      .find({})
      .sort({ detectedAt: -1 })
      .limit(100)
      .toArray();
    notifications = await ctx.db
      .collection<IncidentNotificationDoc>("incidentNotifications")
      .find({})
      .toArray();
  } else if (ctx.fallback) {
    incidents = [...ctx.fallback.incidents].sort(
      (a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );
    notifications = [...ctx.fallback.incidentNotifications];
  }

  if (typeFilter && typeFilter !== "all") {
    incidents = incidents.filter((i) => i.incidentType === typeFilter);
  }
  if (statusFilter && statusFilter !== "all") {
    incidents = incidents.filter((i) => i.incidentStatus === statusFilter);
  }
  if (search) {
    incidents = incidents.filter(
      (i) =>
        i.incidentId.toLowerCase().includes(search) ||
        i.incidentTitle.toLowerCase().includes(search) ||
        i.incidentLocation.areaName.toLowerCase().includes(search) ||
        i.detectionExplanation.toLowerCase().includes(search)
    );
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

    const myNotifs = volunteer
      ? notifications.filter((n) => n.volunteerId === volunteer._id)
      : [];
    const myIncidentIds = new Set(myNotifs.map((n) => n.incidentId));

    const volunteerIncidents = incidents
      .filter((inc) => myIncidentIds.has(inc.incidentId))
      .map((inc) => {
        const notif = myNotifs.find((n) => n.incidentId === inc.incidentId);
        return {
          ...sanitizeIncidentForVolunteer(inc),
          myNotification: notif || null,
        };
      });

    return NextResponse.json({
      incidents: volunteerIncidents,
      dbMode: ctx.mode,
      dbNotice: ctx.notice,
    });
  }

  const enriched = incidents.map((inc) => {
    const incNotifs = notifications.filter(
      (n) => n.incidentId === inc.incidentId
    );
    return {
      ...inc,
      notificationSummary: {
        totalNotified: incNotifs.length,
        telegramSent: incNotifs.filter((n) => n.telegramStatus === "sent")
          .length,
        accepted: incNotifs.filter(
          (n) => n.acknowledgementStatus === "accepted"
        ).length,
      },
    };
  });

  return NextResponse.json({
    incidents: enriched,
    stats: {
      total: incidents.length,
      activeCount: incidents.filter((i) => i.incidentStatus !== "closed")
        .length,
      dispatchedCount: incidents.filter(
        (i) =>
          i.incidentStatus === "dispatched" ||
          i.incidentStatus === "acknowledged"
      ).length,
      volunteersNotified: notifications.length,
    },
    dbMode: ctx.mode,
    dbNotice: ctx.notice,
  });
}

export async function POST(request: Request) {
  const isAiService = verifyAiServiceSecret(request);
  const user = isAiService ? null : await getSessionUser();

  if (!isAiService && (!user || (user.role !== "operator" && user.role !== "admin"))) {
    return NextResponse.json(
      { error: "Operator, Admin, or authenticated AI service credentials required." },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as {
      incidentId?: string;
      incidentType?: IncidentType;
      incidentConfidence?: number;
      confidenceType?: "heuristic" | "calibrated_ml";
      detectionExplanation?: string;
      cameraSource?: string;
      areaPresetId?: string;
      areaName?: string;
      approxLabel?: string;
      lng?: number;
      lat?: number;
      confirmationStatus?: IncidentDoc["confirmationStatus"];
      sanitizedPreviewReference?: string | null;
      sanitizedTimelineFrames?: IncidentDoc["sanitizedTimelineFrames"];
      previewSha256?: string | null;
      isSimulatedDemo?: boolean;
      autoDispatch?: boolean;
    };

    const incidentType: IncidentType =
      body.incidentType && body.incidentType in INCIDENT_TYPE_LABELS
        ? body.incidentType
        : "potential_aggression";

    const preset =
      DEMO_LOCATION_PRESETS.find((p) => p.id === body.areaPresetId) ||
      DEMO_LOCATION_PRESETS[0];

    const areaName = body.areaName?.trim() || preset.areaName;
    const approxLabel = body.approxLabel?.trim() || preset.approxLabel;
    const lng =
      typeof body.lng === "number" && Number.isFinite(body.lng)
        ? body.lng
        : preset.lng;
    const lat =
      typeof body.lat === "number" && Number.isFinite(body.lat)
        ? body.lat
        : preset.lat;

    const now = new Date().toISOString();
    const incidentId =
      body.incidentId?.trim() ||
      `HS-${Date.now().toString().slice(-6)}-${Math.random()
        .toString(36)
        .slice(2, 5)
        .toUpperCase()}`;

    const confidence = Math.max(
      1,
      Math.min(99, Math.round(body.incidentConfidence ?? 68))
    );

    const doc: IncidentDoc = {
      _id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      incidentId,
      incidentType,
      incidentTitle: INCIDENT_TYPE_LABELS[incidentType].title,
      incidentConfidence: confidence,
      confidenceType: body.confidenceType || "heuristic",
      detectionExplanation:
        body.detectionExplanation?.trim() ||
        INCIDENT_TYPE_LABELS[incidentType].disclaimer,
      incidentLocation: {
        areaName,
        approxLabel,
        coordinates: {
          type: "Point",
          coordinates: [lng, lat],
        },
      },
      cameraSource: body.cameraSource?.trim() || "laptop_webcam",
      detectedAt: now,
      confirmationStatus:
        body.confirmationStatus ||
        (incidentType === "suspected_collapse"
          ? "auto_confirmed"
          : "pending_timer"),
      incidentStatus: "open",
      sanitizedPreviewReference: body.sanitizedPreviewReference ?? null,
      sanitizedTimelineFrames: body.sanitizedTimelineFrames || [],
      previewSha256: body.previewSha256 ?? null,
      isSimulatedDemo: Boolean(body.isSimulatedDemo),
      createdAt: now,
      updatedAt: now,
    };

    const ctx = await getDataContext();
    if (ctx.db) {
      await ctx.db.collection<IncidentDoc>("incidents").insertOne(doc);
    } else if (ctx.fallback) {
      ctx.fallback.incidents.unshift(doc);
      persistFallbackStore();
    }

    await writeAuditLog({
      actorId: isAiService ? "ai-service" : user!.userId,
      actorRole: isAiService ? "ai_service" : user!.role,
      action: "INCIDENT_CREATED",
      resourceType: "incident",
      resourceId: incidentId,
      relevantMetadata: {
        incidentType,
        confidence,
        areaName,
        hasPreview: Boolean(doc.sanitizedPreviewReference || doc.sanitizedTimelineFrames?.length),
      },
    });

    let finalIncident = doc;
    let autoDispatchResult: {
      triggered: boolean;
      threshold: number;
      dispatchedCount: number;
      telegramSentCount: number;
      note?: string;
    } = {
      triggered: false,
      threshold: AUTO_DISPATCH_RISK_THRESHOLD,
      dispatchedCount: 0,
      telegramSentCount: 0,
    };

    // Automatic volunteer alert dispatch when risk score exceeds 75%
    if (
      confidence > AUTO_DISPATCH_RISK_THRESHOLD &&
      body.autoDispatch !== false
    ) {
      const dispatch = await dispatchIncidentAlerts({
        incidentId,
        actorId: isAiService ? "ai-service" : user!.userId,
        actorRole: isAiService ? "ai_service" : user!.role,
        isAutoDispatch: true,
      });
      if (dispatch.updatedIncident) {
        finalIncident = dispatch.updatedIncident;
      }
      autoDispatchResult = {
        triggered: dispatch.ok,
        threshold: AUTO_DISPATCH_RISK_THRESHOLD,
        dispatchedCount: dispatch.dispatchedCount,
        telegramSentCount: dispatch.telegramSentCount,
        note: dispatch.ok
          ? `Automatically dispatched to ${dispatch.dispatchedCount} verified volunteer(s).`
          : dispatch.error,
      };
    }

    return NextResponse.json(
      { incident: finalIncident, autoDispatch: autoDispatchResult },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create incident error:", err);
    return NextResponse.json(
      { error: "Unable to store incident." },
      { status: 500 }
    );
  }
}
