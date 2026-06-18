-- ============================================================================
-- Spectra Suite — 003: fix infinite-recursion RLS + own-row read policies
-- ============================================================================
--
-- HOW TO RUN: paste this whole file into Supabase Dashboard → SQL Editor → Run.
-- Idempotent and safe to re-run.
--
-- THE BUG THIS FIXES
-- ------------------
-- The original policies checked super_admin like:
--     EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
-- Because that subquery reads `profiles` from inside a `profiles` policy, Postgres
-- raises: "infinite recursion detected in policy for relation profiles" on EVERY
-- read of the table — so even `SELECT * FROM profiles WHERE id = auth.uid()` fails.
-- The app then sees a null profile and shows "Access Denied" even for super_admins.
--
-- THE FIX
-- -------
-- Move the role check into SECURITY DEFINER functions. They run as the function
-- owner (which bypasses RLS), so reading `profiles` inside them does NOT re-trigger
-- the policies → no recursion. All policies then call these helpers.
-- ============================================================================

-- ─── Helper functions (SECURITY DEFINER → bypass RLS, no recursion) ──────────
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_nomina_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('super_admin', 'module_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_nomina_admin() TO authenticated;

-- ─── profiles ────────────────────────────────────────────────────────────────
-- Users always read their OWN row (non-recursive). Super admins manage all rows
-- via the helper (no recursion). Drop every prior variant first.
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins manage all profiles" ON public.profiles;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Super admins manage all profiles" ON public.profiles
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ─── user_module_permissions ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own permissions" ON public.user_module_permissions;
DROP POLICY IF EXISTS "Users can read own permissions" ON public.user_module_permissions;
DROP POLICY IF EXISTS "Super admins manage permissions" ON public.user_module_permissions;

CREATE POLICY "Users can read own permissions" ON public.user_module_permissions
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Super admins manage permissions" ON public.user_module_permissions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ─── company_settings ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admins manage company settings" ON public.company_settings;
CREATE POLICY "Super admins manage company settings" ON public.company_settings
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ─── integrations ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Super admins manage integrations" ON public.integrations;
CREATE POLICY "Super admins manage integrations" ON public.integrations
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ─── payroll_runs ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Nomina admins manage payroll" ON public.payroll_runs;
CREATE POLICY "Nomina admins manage payroll" ON public.payroll_runs
  FOR ALL USING (public.is_nomina_admin()) WITH CHECK (public.is_nomina_admin());

-- ─── vacation_payments ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Nomina admins manage vacation payments" ON public.vacation_payments;
CREATE POLICY "Nomina admins manage vacation payments" ON public.vacation_payments
  FOR ALL USING (public.is_nomina_admin()) WITH CHECK (public.is_nomina_admin());
