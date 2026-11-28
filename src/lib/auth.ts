import "server-only";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { UserRole } from "./types";

export const SESSION_COOKIE_NAME = "hershield_session";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  exp?: number;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret === "replace-with-a-strong-random-32-char-secret") {
    if (process.env.VERCEL === "1") {
      throw new Error(
        "AUTH_SECRET must be set in Vercel production environment variables."
      );
    }
    return new TextEncoder().encode(
      "hershield-local-dev-secret-change-before-deploy"
    );
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(
  payload: Omit<SessionPayload, "exp">
): Promise<string> {
  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecretKey());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId === "string" &&
      typeof payload.email === "string" &&
      typeof payload.name === "string" &&
      (payload.role === "operator" ||
        payload.role === "volunteer" ||
        payload.role === "admin")
    ) {
      return {
        userId: payload.userId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  const useSecureCookie =
    process.env.VERCEL === "1" ||
    Boolean(process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://"));
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: useSecureCookie,
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function verifyAiServiceSecret(request: Request): boolean {
  const configured = process.env.AI_SERVICE_SECRET?.trim();
  const devDefault = "hershield-local-ai-secret";
  const expected =
    configured && configured !== "replace-with-shared-ai-service-secret"
      ? configured
      : process.env.VERCEL === "1"
        ? ""
        : devDefault;
  if (!expected) return false;
  const provided = request.headers.get("x-hershield-ai-secret")?.trim();
  return Boolean(provided && provided === expected);
}
