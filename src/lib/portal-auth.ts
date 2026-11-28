import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionPayload } from "./auth";
import type { UserRole } from "./types";

export async function requirePortalSession(
  allowedRoles: UserRole[],
  loginPath: string
): Promise<SessionPayload> {
  const user = await getSessionUser();
  if (!user || !allowedRoles.includes(user.role)) {
    redirect(loginPath);
  }
  return user;
}
