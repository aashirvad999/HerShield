import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  createSessionToken,
  getSessionUser,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { findUserByEmail, getDataContext, writeAuditLog } from "@/lib/data-access";

export async function GET() {
  const user = await getSessionUser();
  const ctx = await getDataContext();
  return NextResponse.json({
    user,
    dbMode: ctx.mode,
    dbNotice: ctx.notice,
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      expectedRole?: string;
    };
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (user.accountStatus === "suspended") {
      return NextResponse.json(
        { error: "This account has been suspended by an administrator." },
        { status: 403 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    if (
      body.expectedRole &&
      user.role !== body.expectedRole &&
      !(body.expectedRole === "operator" && user.role === "admin")
    ) {
      return NextResponse.json(
        {
          error: `Account role is "${user.role}", which cannot sign into the ${body.expectedRole} portal.`,
        },
        { status: 403 }
      );
    }

    const token = await createSessionToken({
      userId: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    await setSessionCookie(token);

    await writeAuditLog({
      actorId: user._id,
      actorRole: user.role,
      action: "USER_LOGIN",
      resourceType: "auth",
      resourceId: user._id,
      relevantMetadata: { email: user.email },
    });

    return NextResponse.json({
      user: {
        userId: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Unable to process sign-in request." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const user = await getSessionUser();
  await clearSessionCookie();
  if (user) {
    await writeAuditLog({
      actorId: user.userId,
      actorRole: user.role,
      action: "USER_LOGOUT",
      resourceType: "auth",
      resourceId: user.userId,
      relevantMetadata: {},
    });
  }
  return NextResponse.json({ ok: true });
}
