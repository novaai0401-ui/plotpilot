-- Plot Broker — Row-Level Security policies
--
-- Strategy: every tenant-scoped table uses RLS keyed on a per-request GUC
-- `app.current_org_id`. The app sets this GUC at the start of each transaction
-- by reading the orgId from our User table after JWT validation.
--
-- Apply this AFTER `prisma db push` (Prisma migrations don't manage RLS).
-- Run via: psql $DATABASE_URL -f prisma/migrations/rls/001_enable_rls.sql
--
-- To set the GUC from app code (in lib/db/with-org.ts):
--   await prisma.$executeRawUnsafe(`SET LOCAL app.current_org_id = '${orgId}'`);
--
-- The service_role key bypasses RLS, so server-side admin tasks (cron, webhooks)
-- continue to work. Anon/authenticated users are constrained.

-- Helper: read current org from GUC (returns NULL if unset)
CREATE OR REPLACE FUNCTION app_current_org_id() RETURNS text AS $$
  SELECT current_setting('app.current_org_id', true)
$$ LANGUAGE sql STABLE;

-- Organization: a user can only see their own org
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON "Organization";
CREATE POLICY org_isolation ON "Organization"
  USING (id = app_current_org_id())
  WITH CHECK (id = app_current_org_id());

-- Generic tenant policy macro per table
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'User', 'Plot', 'Invitation', 'Visit', 'Message',
    'WhatsAppConfig', 'AnalyticsEvent'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING ("orgId" = app_current_org_id())
         WITH CHECK ("orgId" = app_current_org_id())',
      t
    );
  END LOOP;
END$$;

-- Allow the service_role to bypass for admin/cron jobs (this is Supabase default,
-- but state it explicitly so future readers know):
--   ALTER TABLE ... FORCE ROW LEVEL SECURITY  -- do NOT use; service_role would also be filtered.

-- Sanity check view: any row reachable by current GUC
-- SELECT * FROM "Plot";  -- returns only current_org rows
