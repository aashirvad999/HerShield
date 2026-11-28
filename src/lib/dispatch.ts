import "server-only";
import {
  findNearbyEligibleVolunteers,
  getDataContext,
  persistFallbackStore,
  writeAuditLog,
} from "./data-access";
import { formatApproxDistance } from "./geo";
import { sendVolunteerIncidentAlert } from "./telegram";
import type {
  IncidentDoc,
  IncidentNotificationDoc,
  UserRole,
} from "./types";

export const AUTO_DISPATCH_RISK_THRESHOLD = 75;

export interface DispatchResult {
  ok: boolean;
  error?: string;
  dispatchedCount: number;
  telegramSentCount: number;
  notifications: IncidentNotificationDoc[];
  updatedIncident?: IncidentDoc;
}

export async function dispatchIncidentAlerts(params: {
  incidentId: string;
  actorId: string;
  actorRole: UserRole | "system" | "ai_service";
  selectedVolunteerIds?: string[];
  maxDistanceMeters?: number;
  isAutoDispatch?: boolean;
}): Promise<DispatchResult> {
  const ctx = await getDataContext();
  let incident: IncidentDoc | null = null;

  if (ctx.db) {
    incident = await ctx.db
      .collection<IncidentDoc>("incidents")
      .findOne({ incidentId: params.incidentId });
  } else if (ctx.fallback) {
    incident =
      ctx.fallback.incidents.find((i) => i.incidentId === params.incidentId) ||
      null;
  }

  if (!incident) {
    return {
      ok: false,
      error: "Incident not found.",
      dispatchedCount: 0,
      telegramSentCount: 0,
      notifications: [],
    };
  }

  const [lng, lat] = incident.incidentLocation.coordinates.coordinates;
  const nearbyEligible = await findNearbyEligibleVolunteers(
    lng,
    lat,
    params.maxDistanceMeters ?? 15000
  );

  // Server strictly enforces that only Verified & alertEligible volunteers receive alerts
  const selectedSet =
    Array.isArray(params.selectedVolunteerIds) &&
    params.selectedVolunteerIds.length > 0
      ? new Set(params.selectedVolunteerIds)
      : null;

  const recipients = selectedSet
    ? nearbyEligible.filter((v) => selectedSet.has(v._id))
    : nearbyEligible;

  if (recipients.length === 0) {
    const note =
      "No verified, alert-eligible volunteers found within range for auto-dispatch.";
    if (params.isAutoDispatch) {
      if (ctx.db) {
        await ctx.db
          .collection<IncidentDoc>("incidents")
          .updateOne(
            { incidentId: params.incidentId },
            { $set: { autoDispatchNote: note, updatedAt: new Date().toISOString() } }
          );
      } else if (ctx.fallback) {
        incident.autoDispatchNote = note;
        persistFallbackStore();
      }
    }
    return {
      ok: false,
      error:
        "No verified, alert-eligible volunteers found within range for the selected location.",
      dispatchedCount: 0,
      telegramSentCount: 0,
      notifications: [],
      updatedIncident: incident,
    };
  }

  const now = new Date().toISOString();
  const createdNotifications: IncidentNotificationDoc[] = [];

  for (const vol of recipients) {
    const approxDistanceText = formatApproxDistance(vol.distanceMeters);
    const tgResult = await sendVolunteerIncidentAlert({
      chatId: vol.telegramChatId,
      incident,
      approxDistanceText,
    });

    const notifDoc: IncidentNotificationDoc = {
      _id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      incidentId: incident.incidentId,
      volunteerId: vol._id,
      volunteerName: vol.displayName,
      registeredArea: vol.registeredArea,
      distanceMeters: vol.distanceMeters,
      telegramStatus: tgResult.status,
      telegramError: tgResult.error || null,
      notificationSentAt: now,
      acknowledgementStatus: "pending",
      acknowledgedAt: null,
    };

    if (ctx.db) {
      await ctx.db
        .collection<IncidentNotificationDoc>("incidentNotifications")
        .updateOne(
          { incidentId: incident.incidentId, volunteerId: vol._id },
          { $set: notifDoc },
          { upsert: true }
        );
    } else if (ctx.fallback) {
      const idx = ctx.fallback.incidentNotifications.findIndex(
        (n) =>
          n.incidentId === incident.incidentId && n.volunteerId === vol._id
      );
      if (idx >= 0) {
        ctx.fallback.incidentNotifications[idx] = notifDoc;
      } else {
        ctx.fallback.incidentNotifications.push(notifDoc);
      }
    }

    createdNotifications.push(notifDoc);
  }

  const telegramSentCount = createdNotifications.filter(
    (n) => n.telegramStatus === "sent"
  ).length;

  const newConfirmationStatus =
    incident.confirmationStatus === "pending_timer"
      ? params.isAutoDispatch
        ? "auto_confirmed"
        : "confirmed"
      : incident.confirmationStatus;

  const autoNote = params.isAutoDispatch
    ? `Auto-dispatched because risk score (${incident.incidentConfidence}%) exceeded ${AUTO_DISPATCH_RISK_THRESHOLD}%.`
    : undefined;

  const patchFields: Partial<IncidentDoc> = {
    confirmationStatus: newConfirmationStatus,
    incidentStatus: "dispatched",
    updatedAt: now,
    ...(params.isAutoDispatch
      ? { autoDispatched: true, autoDispatchNote: autoNote }
      : {}),
  };

  if (ctx.db) {
    await ctx.db
      .collection<IncidentDoc>("incidents")
      .updateOne({ incidentId: params.incidentId }, { $set: patchFields });
  } else if (ctx.fallback) {
    Object.assign(incident, patchFields);
    persistFallbackStore();
  }

  await writeAuditLog({
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: params.isAutoDispatch
      ? "INCIDENT_AUTO_DISPATCHED_HIGH_RISK"
      : "INCIDENT_ALERT_DISPATCHED",
    resourceType: "notification",
    resourceId: params.incidentId,
    relevantMetadata: {
      riskScore: incident.incidentConfidence,
      threshold: AUTO_DISPATCH_RISK_THRESHOLD,
      recipientCount: createdNotifications.length,
      telegramSent: telegramSentCount,
    },
  });

  return {
    ok: true,
    dispatchedCount: createdNotifications.length,
    telegramSentCount,
    notifications: createdNotifications,
    updatedIncident: { ...incident, ...patchFields },
  };
}
