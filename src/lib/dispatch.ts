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
export const VOLUNTEER_NOTIFICATION_COOLDOWN_MS = 60 * 1000; // 1 minute minimum cooldown

declare global {
  var _herShieldVolunteerLastAlertAt: Map<string, number> | undefined;
}

function getCooldownMap(): Map<string, number> {
  if (!globalThis._herShieldVolunteerLastAlertAt) {
    globalThis._herShieldVolunteerLastAlertAt = new Map<string, number>();
  }
  return globalThis._herShieldVolunteerLastAlertAt;
}

export interface DispatchResult {
  ok: boolean;
  error?: string;
  dispatchedCount: number;
  telegramSentCount: number;
  cooldownSkippedCount?: number;
  alreadyNotifiedCount?: number;
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

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const cooldownMap = getCooldownMap();
  const createdNotifications: IncidentNotificationDoc[] = [];
  let alreadyNotifiedCount = 0;
  let cooldownSkippedCount = 0;
  let maxRemainingCooldownSec = 0;

  for (const vol of recipients) {
    // 1. Send notification to a volunteer at most ONCE per incident
    let existingForIncident: IncidentNotificationDoc | null = null;
    if (ctx.db) {
      existingForIncident = await ctx.db
        .collection<IncidentNotificationDoc>("incidentNotifications")
        .findOne({ incidentId: incident.incidentId, volunteerId: vol._id });
    } else if (ctx.fallback) {
      existingForIncident =
        ctx.fallback.incidentNotifications.find(
          (n) =>
            n.incidentId === incident.incidentId && n.volunteerId === vol._id
        ) || null;
    }

    if (existingForIncident) {
      alreadyNotifiedCount += 1;
      continue;
    }

    // 2. Enforce at least 1-minute (60s) cooldown per volunteer across incidents
    let lastAlertMs = cooldownMap.get(vol._id) ?? 0;
    if (ctx.db) {
      const latestNotif = await ctx.db
        .collection<IncidentNotificationDoc>("incidentNotifications")
        .find({ volunteerId: vol._id })
        .sort({ notificationSentAt: -1 })
        .limit(1)
        .next();
      if (latestNotif?.notificationSentAt) {
        const ts = Date.parse(latestNotif.notificationSentAt);
        if (!Number.isNaN(ts)) {
          lastAlertMs = Math.max(lastAlertMs, ts);
        }
      }
    } else if (ctx.fallback) {
      for (const n of ctx.fallback.incidentNotifications) {
        if (n.volunteerId === vol._id && n.notificationSentAt) {
          const ts = Date.parse(n.notificationSentAt);
          if (!Number.isNaN(ts)) {
            lastAlertMs = Math.max(lastAlertMs, ts);
          }
        }
      }
    }

    const elapsedMs = nowMs - lastAlertMs;
    if (lastAlertMs > 0 && elapsedMs < VOLUNTEER_NOTIFICATION_COOLDOWN_MS) {
      cooldownSkippedCount += 1;
      const remSec = Math.ceil(
        (VOLUNTEER_NOTIFICATION_COOLDOWN_MS - elapsedMs) / 1000
      );
      maxRemainingCooldownSec = Math.max(maxRemainingCooldownSec, remSec);
      continue;
    }

    // Claim cooldown slot before async send to prevent concurrent double-sends
    cooldownMap.set(vol._id, nowMs);

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

  if (createdNotifications.length === 0) {
    const reason =
      cooldownSkippedCount > 0
        ? `Volunteer notification cooldown active (${maxRemainingCooldownSec}s remaining of 60s minimum cooldown).`
        : "Selected volunteer(s) were already notified for this incident.";

    if (params.isAutoDispatch) {
      if (ctx.db) {
        await ctx.db
          .collection<IncidentDoc>("incidents")
          .updateOne(
            { incidentId: params.incidentId },
            { $set: { autoDispatchNote: reason, updatedAt: now } }
          );
      } else if (ctx.fallback) {
        incident.autoDispatchNote = reason;
        persistFallbackStore();
      }
    }

    return {
      ok: Boolean(params.isAutoDispatch),
      error: params.isAutoDispatch ? undefined : reason,
      dispatchedCount: 0,
      telegramSentCount: 0,
      cooldownSkippedCount,
      alreadyNotifiedCount,
      notifications: [],
      updatedIncident: incident,
    };
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
    cooldownSkippedCount,
    alreadyNotifiedCount,
    notifications: createdNotifications,
    updatedIncident: { ...incident, ...patchFields },
  };
}
