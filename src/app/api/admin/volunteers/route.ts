import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import {
  getDataContext,
  updateVolunteerStatus,
  writeAuditLog,
} from "@/lib/data-access";
import type {
  UserDoc,
  VerificationStatus,
  VolunteerApplicationDoc,
  VolunteerDoc,
} from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  const ctx = await getDataContext();
  let users: UserDoc[] = [];
  let volunteers: VolunteerDoc[] = [];
  let applications: VolunteerApplicationDoc[] = [];

  if (ctx.db) {
    users = await ctx.db.collection<UserDoc>("users").find({}).toArray();
    volunteers = await ctx.db
      .collection<VolunteerDoc>("volunteers")
      .find({})
      .toArray();
    applications = await ctx.db
      .collection<VolunteerApplicationDoc>("volunteerApplications")
      .find({})
      .sort({ submittedAt: -1 })
      .toArray();
  } else if (ctx.fallback) {
    users = [...ctx.fallback.users];
    volunteers = [...ctx.fallback.volunteers];
    applications = [...ctx.fallback.volunteerApplications];
  }

  const safeUsers = users.map((u) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    accountStatus: u.accountStatus,
    createdAt: u.createdAt,
  }));

  const combined = volunteers.map((v) => {
    const usr = safeUsers.find((u) => u._id === v.userId);
    const app = applications.find((a) => a.userId === v.userId);
    return {
      ...v,
      user: usr || null,
      application: app || null,
    };
  });

  return NextResponse.json({
    volunteers: combined,
    applications,
    users: safeUsers,
    dbMode: ctx.mode,
    dbNotice: ctx.notice,
  });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as {
    userId?: string;
    verificationStatus?: VerificationStatus;
    alertEligible?: boolean;
    reviewNotes?: string;
    accountStatus?: "active" | "suspended";
  };

  if (!body.userId || !body.verificationStatus) {
    return NextResponse.json(
      { error: "userId and verificationStatus are required." },
      { status: 400 }
    );
  }

  const validStatuses: VerificationStatus[] = [
    "Submitted",
    "Under Review",
    "Verified",
    "Rejected",
  ];
  if (!validStatuses.includes(body.verificationStatus)) {
    return NextResponse.json(
      { error: "Invalid verificationStatus." },
      { status: 400 }
    );
  }

  await updateVolunteerStatus({
    userId: body.userId,
    verificationStatus: body.verificationStatus,
    alertEligible:
      body.verificationStatus === "Verified" &&
      (body.alertEligible ?? true) &&
      body.accountStatus !== "suspended",
    reviewNotes:
      body.reviewNotes?.trim() ||
      `Updated to ${body.verificationStatus} by administrator.`,
    reviewedBy: user.userId,
    accountStatus: body.accountStatus,
  });

  await writeAuditLog({
    actorId: user.userId,
    actorRole: "admin",
    action: `ADMIN_SET_VOLUNTEER_${body.verificationStatus
      .toUpperCase()
      .replace(/\s+/g, "_")}`,
    resourceType: "volunteer",
    resourceId: body.userId,
    relevantMetadata: {
      verificationStatus: body.verificationStatus,
      accountStatus: body.accountStatus || "unchanged",
    },
  });

  return NextResponse.json({ ok: true });
}
