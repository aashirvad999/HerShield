import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Db } from "mongodb";
import { hashPassword } from "./auth";
import { haversineDistanceMeters } from "./geo";
import { connectToMongo } from "./mongodb";
import {
  buildSeedApplications,
  buildSeedAuditLogs,
  buildSeedIncidents,
  buildSeedNotifications,
  buildSeedUsers,
  buildSeedVolunteers,
  DEMO_PASSWORDS,
} from "./seed-data";
import type {
  AuditLogDoc,
  IncidentDoc,
  IncidentNotificationDoc,
  UserDoc,
  VerificationStatus,
  VolunteerApplicationDoc,
  VolunteerDoc,
} from "./types";

interface FallbackMemoryStore {
  initialized: boolean;
  users: UserDoc[];
  volunteers: VolunteerDoc[];
  volunteerApplications: VolunteerApplicationDoc[];
  incidents: IncidentDoc[];
  incidentNotifications: IncidentNotificationDoc[];
  auditLogs: AuditLogDoc[];
}

declare global {
  var _herShieldFallbackStore: FallbackMemoryStore | undefined;
  var _herShieldMongoSeeded: boolean | undefined;
}

const LOCAL_STORE_PATH = path.join(
  process.cwd(),
  ".hershield-local-store.json"
);

export function persistFallbackStore(): void {
  if (process.env.VERCEL === "1" || !globalThis._herShieldFallbackStore) {
    return;
  }
  try {
    fs.writeFileSync(
      LOCAL_STORE_PATH,
      JSON.stringify(globalThis._herShieldFallbackStore, null, 2),
      "utf8"
    );
  } catch {
    // Ignore read-only filesystem errors
  }
}

async function getSeededData() {
  const [opHash, adminHash, volHash] = await Promise.all([
    hashPassword(DEMO_PASSWORDS.operator),
    hashPassword(DEMO_PASSWORDS.admin),
    hashPassword(DEMO_PASSWORDS.volunteer),
  ]);
  return {
    users: buildSeedUsers({
      operator: opHash,
      admin: adminHash,
      volunteer: volHash,
    }),
    volunteers: buildSeedVolunteers(),
    volunteerApplications: buildSeedApplications(),
    incidents: buildSeedIncidents(),
    incidentNotifications: buildSeedNotifications(),
    auditLogs: buildSeedAuditLogs(),
  };
}

async function getFallbackStore(): Promise<FallbackMemoryStore> {
  if (!globalThis._herShieldFallbackStore) {
    if (process.env.VERCEL !== "1" && fs.existsSync(LOCAL_STORE_PATH)) {
      try {
        const raw = fs.readFileSync(LOCAL_STORE_PATH, "utf8");
        const parsed = JSON.parse(raw) as FallbackMemoryStore;
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.volunteers)) {
          globalThis._herShieldFallbackStore = parsed;
          return globalThis._herShieldFallbackStore;
        }
      } catch {
        // Fall through to re-seed
      }
    }
    const seed = await getSeededData();
    globalThis._herShieldFallbackStore = {
      initialized: true,
      ...seed,
    };
    persistFallbackStore();
  }
  return globalThis._herShieldFallbackStore;
}

async function ensureMongoSeeded(db: Db): Promise<void> {
  if (globalThis._herShieldMongoSeeded) return;
  const count = await db.collection("users").countDocuments();
  if (count === 0) {
    const seed = await getSeededData();
    await db.collection<UserDoc>("users").insertMany(seed.users);
    await db.collection<VolunteerDoc>("volunteers").insertMany(seed.volunteers);
    await db
      .collection<VolunteerApplicationDoc>("volunteerApplications")
      .insertMany(seed.volunteerApplications);
    await db.collection<IncidentDoc>("incidents").insertMany(seed.incidents);
    await db
      .collection<IncidentNotificationDoc>("incidentNotifications")
      .insertMany(seed.incidentNotifications);
    await db.collection<AuditLogDoc>("auditLogs").insertMany(seed.auditLogs);
  }
  globalThis._herShieldMongoSeeded = true;
}

export async function getDataContext() {
  const conn = await connectToMongo();
  if (conn.db) {
    await ensureMongoSeeded(conn.db);
    return {
      db: conn.db,
      mode: conn.mode,
      notice: null as string | null,
      fallback: null as FallbackMemoryStore | null,
    };
  }
  const fallback = await getFallbackStore();
  return {
    db: null,
    mode: conn.mode,
    notice: conn.error || "Using temporary in-memory fallback.",
    fallback,
  };
}

export async function writeAuditLog(
  entry: Omit<AuditLogDoc, "_id" | "timestamp">
): Promise<void> {
  const ctx = await getDataContext();
  const doc: AuditLogDoc = {
    _id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...entry,
    timestamp: new Date().toISOString(),
  };
  if (ctx.db) {
    await ctx.db.collection<AuditLogDoc>("auditLogs").insertOne(doc);
  } else if (ctx.fallback) {
    ctx.fallback.auditLogs.unshift(doc);
    persistFallbackStore();
  }
}

export async function findUserByEmail(email: string): Promise<UserDoc | null> {
  const normalized = email.trim().toLowerCase();
  const ctx = await getDataContext();
  if (ctx.db) {
    return ctx.db.collection<UserDoc>("users").findOne({ email: normalized });
  }
  return (
    ctx.fallback?.users.find((u) => u.email.toLowerCase() === normalized) ||
    null
  );
}

export async function findUserById(userId: string): Promise<UserDoc | null> {
  const ctx = await getDataContext();
  if (ctx.db) {
    return ctx.db.collection<UserDoc>("users").findOne({ _id: userId });
  }
  return ctx.fallback?.users.find((u) => u._id === userId) || null;
}

export async function findNearbyEligibleVolunteers(
  lng: number,
  lat: number,
  maxDistanceMeters = 15000
): Promise<Array<VolunteerDoc & { distanceMeters: number }>> {
  const ctx = await getDataContext();
  if (ctx.db) {
    const rows = await ctx.db
      .collection<VolunteerDoc>("volunteers")
      .aggregate<VolunteerDoc & { distanceMeters: number }>([
        {
          $geoNear: {
            near: { type: "Point", coordinates: [lng, lat] },
            distanceField: "distanceMeters",
            maxDistance: maxDistanceMeters,
            spherical: true,
            query: {
              verificationStatus: "Verified",
              alertEligible: true,
            },
          },
        },
        { $limit: 25 },
      ])
      .toArray();

    return rows.map((r) => ({
      ...r,
      distanceMeters: Math.round(r.distanceMeters ?? 0),
    }));
  }

  const eligible = (ctx.fallback?.volunteers || []).filter(
    (v) => v.verificationStatus === "Verified" && v.alertEligible
  );

  return eligible
    .map((v) => ({
      ...v,
      distanceMeters: haversineDistanceMeters(
        lng,
        lat,
        v.registeredLocation.coordinates[0],
        v.registeredLocation.coordinates[1]
      ),
    }))
    .filter((v) => v.distanceMeters <= maxDistanceMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/**
 * PrivacyShield projection for Volunteer Portal:
 * Ensures volunteers NEVER receive raw video URLs, internal camera streams,
 * or sensitive operator/victim personal metadata.
 */
export function sanitizeIncidentForVolunteer(incident: IncidentDoc) {
  return {
    incidentId: incident.incidentId,
    incidentType: incident.incidentType,
    incidentTitle: incident.incidentTitle,
    incidentConfidence: incident.incidentConfidence,
    confidenceType: incident.confidenceType,
    detectionExplanation: incident.detectionExplanation,
    approxLocation: incident.incidentLocation.approxLabel,
    areaName: incident.incidentLocation.areaName,
    detectedAt: incident.detectedAt,
    confirmationStatus: incident.confirmationStatus,
    incidentStatus: incident.incidentStatus,
    sanitizedPreviewReference: incident.sanitizedPreviewReference,
    sanitizedTimelineFrames: incident.sanitizedTimelineFrames || [],
    previewSha256: incident.previewSha256,
    isSimulatedDemo: Boolean(incident.isSimulatedDemo),
    privacyShieldVerified: true,
  };
}

export async function updateVolunteerStatus(params: {
  userId: string;
  verificationStatus: VerificationStatus;
  alertEligible: boolean;
  reviewNotes: string;
  reviewedBy: string;
  accountStatus?: "active" | "suspended";
}) {
  const ctx = await getDataContext();
  const now = new Date().toISOString();

  if (ctx.db) {
    await ctx.db.collection<VolunteerDoc>("volunteers").updateOne(
      { userId: params.userId },
      {
        $set: {
          verificationStatus: params.verificationStatus,
          alertEligible:
            params.verificationStatus === "Verified" && params.alertEligible,
          updatedAt: now,
        },
      }
    );
    await ctx.db
      .collection<VolunteerApplicationDoc>("volunteerApplications")
      .updateMany(
        { userId: params.userId },
        {
          $set: {
            applicationStatus: params.verificationStatus,
            reviewNotes: params.reviewNotes,
            reviewedBy: params.reviewedBy,
            reviewedAt: now,
          },
        }
      );
    if (params.accountStatus) {
      await ctx.db
        .collection<UserDoc>("users")
        .updateOne(
          { _id: params.userId },
          { $set: { accountStatus: params.accountStatus, updatedAt: now } }
        );
    }
  } else if (ctx.fallback) {
    const vol = ctx.fallback.volunteers.find((v) => v.userId === params.userId);
    if (vol) {
      vol.verificationStatus = params.verificationStatus;
      vol.alertEligible =
        params.verificationStatus === "Verified" && params.alertEligible;
      vol.updatedAt = now;
    }
    ctx.fallback.volunteerApplications.forEach((app) => {
      if (app.userId === params.userId) {
        app.applicationStatus = params.verificationStatus;
        app.reviewNotes = params.reviewNotes;
        app.reviewedBy = params.reviewedBy;
        app.reviewedAt = now;
      }
    });
    if (params.accountStatus) {
      const usr = ctx.fallback.users.find((u) => u._id === params.userId);
      if (usr) {
        usr.accountStatus = params.accountStatus;
        usr.updatedAt = now;
      }
    }
    persistFallbackStore();
  }
}
