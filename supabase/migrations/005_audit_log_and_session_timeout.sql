-- ============================================================================
-- Spectra Suite — 005: audit log + configurable session timeout
-- ============================================================================
-- HOW TO RUN: paste into Supabase Dashboard → SQL Editor → Run. Safe to re-run.
-- ============================================================================

-- ── Session timeout (super-admin configurable, in company_settings) ──────────
-- Default 480 min (8h). App clamps to [5, 1440].
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS session_timeout_minutes INTEGER DEFAULT 480;

-- ── Audit log ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('auth', 'user_management', 'payroll', 'vacation', 'settings', 'connector')),
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Super admins read everything; everyone can read their own entries.
DROP POLICY IF EXISTS "Super admins can view all audit logs" ON public.audit_log;
CREATE POLICY "Super admins can view all audit logs" ON public.audit_log
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS "Users can view their own audit entries" ON public.audit_log;
CREATE POLICY "Users can view their own audit entries" ON public.audit_log
  FOR SELECT USING (user_id = auth.uid());

-- Any authenticated user may INSERT their own audit entries (the app writes them).
DROP POLICY IF EXISTS "Authenticated users can insert audit entries" ON public.audit_log;
CREATE POLICY "Authenticated users can insert audit entries" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
