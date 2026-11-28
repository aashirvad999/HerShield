import "server-only";
import { MongoClient, Db } from "mongodb";

declare global {
  var _herShieldMongoPromise: Promise<MongoClient> | undefined;
  var _herShieldIndexesReady: boolean | undefined;
}

export interface DbConnectionResult {
  db: Db | null;
  mode: "mongodb_atlas" | "unconfigured" | "connection_error";
  error?: string;
}

function getMongoConfig() {
  const uri = process.env.MONGODB_URI?.trim();
  const dbName = process.env.MONGODB_DB?.trim() || "hershield";
  return { uri, dbName };
}

async function ensureIndexes(db: Db) {
  if (globalThis._herShieldIndexesReady) return;
  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("volunteers").createIndex({ registeredLocation: "2dsphere" }),
    db.collection("volunteers").createIndex({ userId: 1 }, { unique: true }),
    db
      .collection("volunteers")
      .createIndex({ verificationStatus: 1, alertEligible: 1 }),
    db.collection("volunteers").createIndex({ telegramLinkCode: 1 }),
    db
      .collection("volunteerApplications")
      .createIndex({ userId: 1, submittedAt: -1 }),
    db
      .collection("volunteerApplications")
      .createIndex({ applicationStatus: 1 }),
    db.collection("incidents").createIndex({ incidentId: 1 }, { unique: true }),
    db.collection("incidents").createIndex({ detectedAt: -1 }),
    db.collection("incidents").createIndex({ incidentStatus: 1 }),
    db
      .collection("incidents")
      .createIndex({ "incidentLocation.coordinates": "2dsphere" }),
    db
      .collection("incidentNotifications")
      .createIndex({ incidentId: 1, volunteerId: 1 }),
    db
      .collection("incidentNotifications")
      .createIndex({ volunteerId: 1, notificationSentAt: -1 }),
    db.collection("auditLogs").createIndex({ timestamp: -1 }),
    db.collection("auditLogs").createIndex({ resourceId: 1 }),
  ]);
  globalThis._herShieldIndexesReady = true;
}

export async function connectToMongo(): Promise<DbConnectionResult> {
  const { uri, dbName } = getMongoConfig();
  if (!uri || uri.includes("<username>") || uri.includes("<password>")) {
    return {
      db: null,
      mode: "unconfigured",
      error:
        "MONGODB_URI is not configured. Running in local in-memory fallback mode (records are temporary).",
    };
  }

  try {
    if (!globalThis._herShieldMongoPromise) {
      const client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });
      globalThis._herShieldMongoPromise = client.connect();
    }

    const client = await globalThis._herShieldMongoPromise;
    const db = client.db(dbName);
    await db.command({ ping: 1 });
    await ensureIndexes(db);
    return { db, mode: "mongodb_atlas" };
  } catch (err) {
    globalThis._herShieldMongoPromise = undefined;
    const message =
      err instanceof Error ? err.message : "Failed to connect to MongoDB Atlas";
    return {
      db: null,
      mode: "connection_error",
      error: `MongoDB Atlas connection failed (${message}). Running in temporary fallback mode.`,
    };
  }
}
