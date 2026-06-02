import { Suspense } from "react";
import { prisma } from "@/lib/db/prisma";
import { verifyTeamInviteToken } from "@/lib/auth/team-invite-token";
import { SignupForm } from "./signup-form";

/**
 * Signup landing.
 *
 * Server-side responsibilities (this file):
 *   - Resolve `?team=<token>` to a verified preview (org name, role, invited email)
 *     so the form can render a trustworthy "You're joining X as Y" banner.
 *     Works for BOTH backends — HMAC and ML-DSA — because we use the same
 *     `verifyTeamInviteToken()` the API uses.
 *   - Resolve `?invite=<token>` (client invite) to an org name via the DB.
 *   - Surface invalid / expired tokens up-front instead of after the user types a password.
 *
 * Client-side responsibilities (signup-form.tsx):
 *   - Render the form, call supabase.auth.signUp(), call /api/auth/provision.
 *
 * Why the split: the previous all-client implementation could only decode HMAC
 * tokens (it split on `.` and base64-decoded the body), so any deploy with the
 * ML-DSA backend enabled silently lost the prefill — generic "Join the team"
 * with empty fields, even when an invite was clearly present. Server-side
 * verify means both backends work and we can trust the displayed data.
 */

type TeamPreview =
  | {
      kind: "team";
      status: "valid";
      orgName: string;
      role: "broker_admin" | "broker_agent";
      email: string;
      name?: string;
    }
  | { kind: "team"; status: "invalid"; reason: string }
  | { kind: "team"; status: "expired" };

type ClientPreview =
  | { kind: "client"; status: "valid"; orgName: string; expiresAt: Date }
  | { kind: "client"; status: "invalid"; reason: string }
  | { kind: "client"; status: "expired" };

type InvitePreview = TeamPreview | ClientPreview | null;

async function resolveTeamPreview(token: string): Promise<TeamPreview> {
  const result = await Promise.resolve(verifyTeamInviteToken(token));
  if (!result.ok) {
    if (/expired/i.test(result.error)) return { kind: "team", status: "expired" };
    return { kind: "team", status: "invalid", reason: result.error };
  }
  const org = await prisma.organization.findUnique({
    where: { id: result.payload.orgId },
    select: { name: true },
  });
  if (!org) {
    return { kind: "team", status: "invalid", reason: "Inviting organization no longer exists." };
  }
  return {
    kind: "team",
    status: "valid",
    orgName: org.name,
    role: result.payload.role,
    email: result.payload.email,
    name: result.payload.name,
  };
}

async function resolveClientPreview(token: string): Promise<ClientPreview> {
  const inv = await prisma.invitation.findUnique({
    where: { token },
    select: {
      status: true,
      expiresAt: true,
      org: { select: { name: true } },
    },
  });
  if (!inv) return { kind: "client", status: "invalid", reason: "Invite link not found." };
  if (inv.status !== "pending") {
    return { kind: "client", status: "invalid", reason: `This invite has already been ${inv.status}.` };
  }
  if (inv.expiresAt < new Date()) return { kind: "client", status: "expired" };
  return { kind: "client", status: "valid", orgName: inv.org.name, expiresAt: inv.expiresAt };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { team?: string; invite?: string };
}) {
  let preview: InvitePreview = null;
  if (searchParams.team) {
    preview = await resolveTeamPreview(searchParams.team);
  } else if (searchParams.invite) {
    preview = await resolveClientPreview(searchParams.invite);
  }

  return (
    // useSearchParams in the client form still requires a Suspense boundary at build time.
    <Suspense>
      <SignupForm preview={preview} />
    </Suspense>
  );
}
