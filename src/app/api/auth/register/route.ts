import { NextResponse } from "next/server";
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth";
import {
  findUserByEmail,
  getDataContext,
  writeAuditLog,
} from "@/lib/data-access";
import {
  DEMO_LOCATION_PRESETS,
  type UserDoc,
  type VolunteerApplicationDoc,
  type VolunteerDoc,
} from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      password?: string;
      areaPresetId?: string;
      registeredArea?: string;
      lng?: number;
      lat?: number;
      consentAccepted?: boolean;
      documentName?: string;
      documentLabel?: string;
    };

    const name = body.name?.trim() || "";
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password || "";

    if (!name || !email || password.length < 8) {
      return NextResponse.json(
        {
          error:
            "Full name, valid email, and a password of at least 8 characters are required.",
        },
        { status: 400 }
      );
    }

    if (!body.consentAccepted) {
      return NextResponse.json(
        {
          error:
            "Volunteer safety & privacy consent must be accepted before submitting.",
        },
        { status: 400 }
      );
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const preset = DEMO_LOCATION_PRESETS.find(
      (p) => p.id === body.areaPresetId
    );
    const registeredArea =
      body.registeredArea?.trim() ||
      preset?.areaName ||
      "Indiranagar 100ft Rd, Bengaluru";
    const lng =
      typeof body.lng === "number" && Number.isFinite(body.lng)
        ? body.lng
        : preset?.lng ?? 77.6408;
    const lat =
      typeof body.lat === "number" && Number.isFinite(body.lat)
        ? body.lat
        : preset?.lat ?? 12.9784;

    const now = new Date().toISOString();
    const userId = `usr-vol-${Date.now()}`;
    const volId = `vol-${Date.now()}`;
    const linkCode = `HS-VOL-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const passwordHash = await hashPassword(password);

    const userDoc: UserDoc = {
      _id: userId,
      name,
      email,
      passwordHash,
      role: "volunteer",
      accountStatus: "active",
      createdAt: now,
      updatedAt: now,
    };

    const volunteerDoc: VolunteerDoc = {
      _id: volId,
      userId,
      displayName: `${name.split(" ")[0]} [DEMO]`,
      registeredArea,
      registeredLocation: {
        type: "Point",
        coordinates: [lng, lat],
      },
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkCode: linkCode,
      verificationStatus: "Submitted",
      alertEligible: false,
      isSimulatedDemo: true,
      createdAt: now,
      updatedAt: now,
    };

    const appDoc: VolunteerApplicationDoc = {
      _id: `app-${Date.now()}`,
      userId,
      applicantName: name,
      applicantEmail: email,
      registeredArea,
      applicationStatus: "Submitted",
      documentReferences: [
        {
          docId: `doc-${Date.now()}`,
          label:
            body.documentLabel?.trim() ||
            "Simulated Community Volunteer ID (Demo Placeholder)",
          fileName:
            body.documentName?.trim() || "demo-volunteer-id-placeholder.txt",
          mimeType: "text/plain",
          sizeBytes: 512,
          uploadedAt: now,
          isDemoPlaceholder: true,
        },
      ],
      consentStatus: true,
      reviewNotes:
        "Submitted via Volunteer Portal. Pending administrator manual verification.",
      reviewedBy: null,
      reviewedAt: null,
      submittedAt: now,
    };

    const ctx = await getDataContext();
    if (ctx.db) {
      await ctx.db.collection<UserDoc>("users").insertOne(userDoc);
      await ctx.db
        .collection<VolunteerDoc>("volunteers")
        .insertOne(volunteerDoc);
      await ctx.db
        .collection<VolunteerApplicationDoc>("volunteerApplications")
        .insertOne(appDoc);
    } else if (ctx.fallback) {
      ctx.fallback.users.push(userDoc);
      ctx.fallback.volunteers.push(volunteerDoc);
      ctx.fallback.volunteerApplications.unshift(appDoc);
    }

    await writeAuditLog({
      actorId: userId,
      actorRole: "volunteer",
      action: "VOLUNTEER_REGISTERED",
      resourceType: "volunteer_application",
      resourceId: appDoc._id,
      relevantMetadata: { registeredArea, verificationStatus: "Submitted" },
    });

    const token = await createSessionToken({
      userId,
      email,
      name,
      role: "volunteer",
    });
    await setSessionCookie(token);

    return NextResponse.json(
      {
        user: { userId, email, name, role: "volunteer" },
        volunteer: volunteerDoc,
        application: appDoc,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "Unable to complete volunteer registration." },
      { status: 500 }
    );
  }
}
