-- ============================================================================
-- Spectra Suite — 007: tamper-proof audit logging via SECURITY DEFINER RPC
-- ============================================================================
-- HOW TO RUN: paste into Supabase Dashboard → SQL Editor → Run. Safe to re-run.
--
-- After this migration the audit_log table is READ-ONLY to users: the only way
-- to write a row is through log_audit_event(), which runs as the function owner
-- (SECURITY DEFINER) and stamps auth.uid() server-side. Users can SELECT their
-- own rows (super admins all rows) but cannot INSERT / UPDATE / DELETE.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action TEXT,
  p_category TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_user_email TEXT;
  v_headers JSON;
BEGIN
  -- Identity is taken server-side from the JWT — callers cannot spoof it.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'log_audit_event requires an authenticated user';
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  -- Request metadata (best-effort; the `true` flag returns NULL instead of
  -- erroring when the GUC is not set in this context).
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;

  INSERT INTO public.audit_log (
    user_id, user_email, action, category, resource_type, resource_id,
    details, ip_address, user_agent, status, error_message
  ) VALUES (
    auth.uid(),
    v_user_email,
    p_action,
    p_category,
    p_resource_type,
    p_resource_id,
    p_details,
    COALESCE(v_headers ->> 'cf-connecting-ip', v_headers ->> 'x-forwarded-for'),
    v_headers ->> 'user-agent',
    p_status,
    p_error_message
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;

-- ── Lock down the table: SELECT only; writes happen exclusively via the RPC ──
-- Remove the direct-insert policy added in migration 005.
DROP POLICY IF EXISTS "Authenticated users can insert audit entries" ON public.audit_log;

DROP POLICY IF EXISTS "Super admins can view all audit logs" ON public.audit_log;
CREATE POLICY "Super admins can view all audit logs" ON public.audit_log
  FOR SELECT USING (public.is_super_admin());

DROP POLICY IF EXISTS "Users can view their own audit entries" ON public.audit_log;
CREATE POLICY "Users can view their own audit entries" ON public.audit_log
  FOR SELECT USING (user_id = auth.uid());

-- No INSERT / UPDATE / DELETE policies exist → direct writes from the client are
-- blocked by RLS. The SECURITY DEFINER RPC bypasses RLS as the table owner.
