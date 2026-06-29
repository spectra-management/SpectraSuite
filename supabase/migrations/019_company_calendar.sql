-- 019_company_calendar.sql
--
-- Company calendar shown to everyone (employees included):
--   1. company_events    -- activities/events. READ: any authenticated user.
--                           WRITE: managers (super_admin or module_admin) via is_manager().
--   2. company_birthdays()-- a SECURITY DEFINER function that exposes ONLY non-sensitive
--                           birthday data (name + birth month/day) for the whole company, so
--                           normal employees (who cannot read the employees table) can still
--                           see everyone's birthdays. No year, no sensitive fields are exposed.
--
-- MANUAL RUN ONLY -- not auto-applied. Idempotent. Additive: one table + RLS + one function.
-- Pure ASCII (copy/pastes cleanly into the Supabase SQL editor).

-- 1. Events.
CREATE TABLE IF NOT EXISTS public.company_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  event_date  DATE NOT NULL,
  all_day     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_events_date_idx ON public.company_events(event_date);

ALTER TABLE public.company_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_events_read" ON public.company_events;
CREATE POLICY "company_events_read" ON public.company_events
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "company_events_write" ON public.company_events;
CREATE POLICY "company_events_write" ON public.company_events
  FOR ALL TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());

-- 2. Company-wide birthdays (safe projection). SECURITY DEFINER so it bypasses the
--    employees-table RLS, but it returns ONLY name + birth month/day (never the year or any
--    sensitive field). Active employees with a valid YYYY-MM-DD date of birth only.
CREATE OR REPLACE FUNCTION public.company_birthdays()
RETURNS TABLE (id TEXT, name TEXT, birth_month INT, birth_day INT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.bamboohr_id,
    NULLIF(trim(concat_ws(' ', e.first_name, e.last_name)), ''),
    NULLIF(split_part(left(e.date_of_birth, 10), '-', 2), '')::int,
    NULLIF(split_part(left(e.date_of_birth, 10), '-', 3), '')::int
  FROM public.employees e
  WHERE e.date_of_birth ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    AND coalesce(e.status, '') <> 'Terminated';
$$;

GRANT EXECUTE ON FUNCTION public.company_birthdays() TO authenticated;

-- Done. Everyone can read events and see company birthdays; only managers write events.
