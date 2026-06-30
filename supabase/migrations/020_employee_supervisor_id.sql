-- 020_employee_supervisor_id.sql
--
-- Make the RRHH ORG CHART work 100% from the database. The employees table stored the
-- supervisor's NAME but not their employee id, so the reporting hierarchy could only be
-- built after a live BambooHR sync. This adds the supervisor id column; the BambooHR sync
-- now writes it, and the app reads it back on login to build the org chart from the DB.
--
-- MANUAL RUN ONLY -- not auto-applied. Idempotent (ADD COLUMN IF NOT EXISTS). Additive:
-- one column, drops no data. Existing rows get '' until the next sync populates them.
--
-- Pure ASCII on purpose (copy/pastes cleanly into the Supabase SQL editor).

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS supervisor_id TEXT NOT NULL DEFAULT '';

-- Tip: run a BambooHR sync (Nomina Employees or RRHH Directory) once after applying this
-- so the supervisor_id column gets filled for every employee.
