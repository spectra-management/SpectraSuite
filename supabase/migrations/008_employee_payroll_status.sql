-- 008_employee_payroll_status.sql
--
-- Adds a permanent payroll inclusion flag to employees.
--
-- payroll_active = false  → employee is EXCLUDED from payroll calculation,
-- Review Hours totals, paystub generation and all payroll reports/exports.
-- The employee still appears in the employee list (just marked inactive).
--
-- This is a Spectra-Suite-LOCAL override, independent of the BambooHR employment
-- status that is synced in. A BambooHR re-sync must NOT reset payroll_active — the
-- client merge preserves the existing value (see Employees/index.tsx handleSync),
-- and only brand-new employees default to active (true).
--
-- NOTE ON CURRENT PERSISTENCE: as of this migration, employee records are stored
-- client-side in localStorage (offline-first; see useEmployeesStore / cloudSync.ts),
-- NOT in a Supabase `employees` table. payroll_active therefore lives on the
-- localStorage Employee object today. This migration is written defensively so it
-- becomes a no-op when there is no employees table yet, and applies automatically
-- if/when employee records are migrated to Postgres.

DO $$
BEGIN
  IF to_regclass('public.employees') IS NOT NULL THEN
    ALTER TABLE public.employees
      ADD COLUMN IF NOT EXISTS payroll_active BOOLEAN NOT NULL DEFAULT true;
  END IF;
END
$$;
