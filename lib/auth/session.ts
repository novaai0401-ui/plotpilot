import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { readSession } from "./native/session-cookie";

export type SessionUser = {
  id: string;
  authId: string;
  orgId: string;
  role: Role;
  name: string;
  email: string | null;
  phone: string;
};

/**
 * Resolve the current request's authenticated user from the native session
 * cookie (`pb_session`). Returns null if no session, expired, or revoked.
 *
 * Replaced the previous Supabase-Auth-backed implementation as part of the
 * native-auth migration. The shape of `SessionUser` is preserved so the rest
 * of the codebase (dozens of consumers) needs no changes.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const resolved = await readSession();
  if (!resolved) return null;
  const u = resolved.user;
  return {
    id: u.id,
    authId: u.authId,
    orgId: u.orgId,
    role: u.role,
    name: u.name,
    email: u.email,
    phone: u.phone,
  };
}

/**
 * Guard for server components / actions. Redirects unauthorized users.
 */
export async function requireUser(allowed?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (allowed && !allowed.includes(user.role)) redirect("/forbidden");
  return user;
}

export const ADMIN_ROLES: Role[] = ["broker_admin", "broker_agent", "super_admin"];
export const BROKER_ROLES: Role[] = ["broker_admin", "broker_agent"];
