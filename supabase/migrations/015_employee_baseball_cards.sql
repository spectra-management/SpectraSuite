-- 015_employee_baseball_cards.sql
--
-- Per-employee "baseball card" overrides. The card is auto-filled from HR data, but every
-- field may be overridden by hand, and several fields (job history, education, hobbies, fun
-- facts, goals, leadership style, account) have no HR source and are manual-only. We store
-- just the overrides as a JSON blob; the app merges them over the live HR values at render.
--
-- Keyed by the BambooHR employee id, like the other employee tables.
--
-- REUSES the access helpers created in 014 (emp_payroll_settings_can_read/write): identical
-- access (read = nomina/rrhh view, write = nomina/rrhh edit or admins). Run 014 first.
--
-- MANUAL RUN ONLY -- not auto-applied. Idempotent. Additive: one table + RLS.
-- Pure ASCII on purpose (copy/pastes cleanly into the Supabase SQL editor).

CREATE TABLE IF NOT EXISTS public.employee_baseball_cards (
  bamboohr_id TEXT PRIMARY KEY,
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID
);

ALTER TABLE public.employee_baseball_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "emp_baseball_cards_read" ON public.employee_baseball_cards;
CREATE POLICY "emp_baseball_cards_read" ON public.employee_baseball_cards
  FOR SELECT TO authenticated USING (public.emp_payroll_settings_can_read());

DROP POLICY IF EXISTS "emp_baseball_cards_write" ON public.employee_baseball_cards;
CREATE POLICY "emp_baseball_cards_write" ON public.employee_baseball_cards
  FOR ALL TO authenticated USING (public.emp_payroll_settings_can_write()) WITH CHECK (public.emp_payroll_settings_can_write());

-- Done. The app reads this table on login and upserts when a card is edited; if it has not
-- been run yet, the app silently falls back to localStorage.
