-- 012_employees_table.sql
--
-- Durable, cloud-authoritative employee directory with rich HR detail (cedula, address,
-- phone, date of birth, etc.) so the Documentos module can fill documents from the
-- DATABASE regardless of whether BambooHR is currently connected.
--
-- MANUAL RUN ONLY -- not auto-applied. Idempotent (IF NOT EXISTS / CREATE OR REPLACE /
-- DROP POLICY IF EXISTS). Additive: creates one table + its RLS. Drops no data.
--
-- Source of truth stays BambooHR: a sync (Nomina Employees page) upserts here; the app
-- reads this table back on login. The data is sensitive (national id / cedula, address,
-- phones), so READ is gated to admins + RRHH/Documentos access and WRITE to admins.
--
-- Pure ASCII on purpose (copy/pastes cleanly into the Supabase SQL editor).

-- 1. Table. Keyed by the BambooHR employee id (the app's Employee.id).
CREATE TABLE IF NOT EXISTS public.employees (
  bamboohr_id       TEXT PRIMARY KEY,
  first_name        TEXT NOT NULL DEFAULT '',
  last_name         TEXT NOT NULL DEFAULT '',
  work_email        TEXT NOT NULL DEFAULT '',
  job_title         TEXT NOT NULL DEFAULT '',
  department        TEXT NOT NULL DEFAULT '',
  hire_date         TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT '',
  country           TEXT NOT NULL DEFAULT '',
  pay_rate          NUMERIC(14,2) NOT NULL DEFAULT 0,
  pay_rate_currency TEXT NOT NULL DEFAULT '',
  pay_type          TEXT NOT NULL DEFAULT '',
  -- Sensitive HR detail:
  national_id       TEXT NOT NULL DEFAULT '',
  address           TEXT NOT NULL DEFAULT '',
  city              TEXT NOT NULL DEFAULT '',
  state             TEXT NOT NULL DEFAULT '',
  zipcode           TEXT NOT NULL DEFAULT '',
  mobile_phone      TEXT NOT NULL DEFAULT '',
  work_phone        TEXT NOT NULL DEFAULT '',
  home_phone        TEXT NOT NULL DEFAULT '',
  date_of_birth     TEXT NOT NULL DEFAULT '',
  gender            TEXT NOT NULL DEFAULT '',
  marital_status    TEXT NOT NULL DEFAULT '',
  nationality       TEXT NOT NULL DEFAULT '',
  supervisor        TEXT NOT NULL DEFAULT '',
  employee_number   TEXT NOT NULL DEFAULT '',
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Access helpers (SECURITY DEFINER so they can read profiles/permissions under RLS).
--    READ: super_admin, module_admin, or anyone with 'view' on rrhh OR documentos
--    (legacy per-user permissions or role-based). WRITE: super_admin / module_admin only.
CREATE OR REPLACE FUNCTION public.employees_can_read()
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
      WHERE ump.user_id = auth.uid() AND ump.module IN ('rrhh','documentos') AND ump.can_view
    )
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      WHERE ur.user_id = auth.uid() AND rp.module IN ('rrhh','documentos') AND rp.can_view
    );
$$;

CREATE OR REPLACE FUNCTION public.employees_can_write()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'module_admin');
$$;

-- 3. Row Level Security.
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_read" ON public.employees;
CREATE POLICY "employees_read" ON public.employees
  FOR SELECT TO authenticated USING (public.employees_can_read());

DROP POLICY IF EXISTS "employees_write" ON public.employees;
CREATE POLICY "employees_write" ON public.employees
  FOR ALL TO authenticated USING (public.employees_can_write()) WITH CHECK (public.employees_can_write());

-- Done. The app upserts on BambooHR sync and reads this table back on login; if it has
-- not been run yet, the app silently falls back to localStorage / live BambooHR.
