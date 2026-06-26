-- 014_employee_payroll_settings.sql
--
-- Per-employee PAYROLL overrides that are app-local (never come from BambooHR) and must be
-- shared across modules. First setting: tax exemption -- a flagged employee has NO statutory
-- deductions withheld (AFP + SFS + ISR all waived; custom deductions still apply), plus a
-- free-text reason. Editable from BOTH the Nomina and RRHH employee profiles; read by the
-- payroll engine when a run is calculated.
--
-- Keyed by the BambooHR employee id (the app's Employee.id), like public.employees (012).
--
-- MANUAL RUN ONLY -- not auto-applied. Idempotent. Additive: one table + helpers + RLS.
-- Pure ASCII on purpose (copy/pastes cleanly into the Supabase SQL editor).

-- 1. Table.
CREATE TABLE IF NOT EXISTS public.employee_payroll_settings (
  bamboohr_id       TEXT PRIMARY KEY,
  tax_exempt        BOOLEAN NOT NULL DEFAULT FALSE,
  tax_exempt_reason TEXT NOT NULL DEFAULT '',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by        UUID
);

-- 2. Access helpers (SECURITY DEFINER so they can read profiles/permissions under RLS).
--    READ: super_admin, module_admin, or anyone with 'view' on nomina OR rrhh.
--    WRITE: super_admin, module_admin, or anyone with 'edit' on nomina OR rrhh.
CREATE OR REPLACE FUNCTION public.emp_payroll_settings_can_read()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'module_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_module_permissions ump
      WHERE ump.user_id = auth.uid() AND ump.module IN ('nomina','rrhh') AND ump.can_view
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      WHERE ur.user_id = auth.uid() AND rp.module IN ('nomina','rrhh') AND rp.can_view
    );
$$;

CREATE OR REPLACE FUNCTION public.emp_payroll_settings_can_write()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'module_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_module_permissions ump
      WHERE ump.user_id = auth.uid() AND ump.module IN ('nomina','rrhh') AND ump.can_edit
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      WHERE ur.user_id = auth.uid() AND rp.module IN ('nomina','rrhh') AND rp.can_edit
    );
$$;

-- 3. Row Level Security.
ALTER TABLE public.employee_payroll_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emp_payroll_settings_read" ON public.employee_payroll_settings;
CREATE POLICY "emp_payroll_settings_read" ON public.employee_payroll_settings
  FOR SELECT TO authenticated USING (public.emp_payroll_settings_can_read());

DROP POLICY IF EXISTS "emp_payroll_settings_write" ON public.employee_payroll_settings;
CREATE POLICY "emp_payroll_settings_write" ON public.employee_payroll_settings
  FOR ALL TO authenticated USING (public.emp_payroll_settings_can_write()) WITH CHECK (public.emp_payroll_settings_can_write());

-- Done. The app reads this table on login and upserts when the flag/reason changes; if it
-- has not been run yet, the app silently falls back to localStorage.
