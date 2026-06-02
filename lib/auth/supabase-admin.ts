import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS, can do admin ops like
 * `auth.admin.deleteUser`. NEVER expose this to a browser bundle.
 *
 * Returns null if SUPABASE_SERVICE_ROLE_KEY isn't configured, so callers
 * can gracefully degrade (e.g. account-deletion endpoint can still wipe
 * Prisma rows even when it can't reach Supabase Auth).
 */
let cached: SupabaseClient | null = null;

export function createSupabaseAdminClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
