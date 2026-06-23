-- 010_cloud_persistence.sql
--
-- Makes business data cloud-authoritative (persisted to AND read back from Supabase).
-- MANUAL RUN ONLY -- this file is NOT auto-applied. It is idempotent (IF NOT EXISTS),
-- additive, and does NOT drop or modify any existing data.
--
-- Until this is run, the app keeps working from localStorage (every cloud write is
-- best-effort and silently no-ops if the column/table is missing). After it is run:
--   - payroll runs round-trip through public.payroll_runs (full object in `data`)
--   - vacation state round-trips through the new public.app_state KV table
--   - connector credentials already use public.integrations (no schema change needed;
--     this release adds the missing READ-BACK in app code)
--
-- Pure ASCII on purpose (copy/pastes cleanly into the Supabase SQL editor).

-- 1. payroll_runs: add a stable app-side key + a full-fidelity JSON copy.
--    The app id (generateId) is NOT a UUID, so it cannot be the UUID primary key;
--    we store it in local_id (the upsert conflict target) and keep the canonical
--    PayrollPeriod object in `data` so entries/totals round-trip for paystubs/reports.
ALTER TABLE public.payroll_runs ADD COLUMN IF NOT EXISTS local_id TEXT;
ALTER TABLE public.payroll_runs ADD COLUMN IF NOT EXISTS data JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_local_id_key
  ON public.payroll_runs (local_id);

-- 2. app_state: generic KV mirror for store blobs that have no faithful relational
--    home (the nested vacation maps: vacation_payments_made, pending_vacation_isr).
--    The localStorage blob is stored verbatim as JSONB keyed by its storage key, so it
--    round-trips losslessly.
CREATE TABLE IF NOT EXISTS public.app_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_state ENABLE ROW LEVEL SECURITY;

-- RLS mirrors payroll/vacation: any authenticated user may READ; only
-- super_admin / module_admin may WRITE (best-effort writes no-op for others).
DROP POLICY IF EXISTS "Authenticated users read app_state" ON public.app_state;
CREATE POLICY "Authenticated users read app_state" ON public.app_state
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage app_state" ON public.app_state;
CREATE POLICY "Admins manage app_state" ON public.app_state
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'module_admin'))
  );

-- Done. No existing rows are touched; columns/table are additive.
