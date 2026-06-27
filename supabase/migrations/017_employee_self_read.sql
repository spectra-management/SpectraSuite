-- 017_employee_self_read.sql
--
-- Employee self-service: let a NON-admin user read THEIR OWN employee row so the Suite can
-- show them their own profile. The match is by email: the row's work_email equals the email
-- on the caller's profile (case-insensitive). Admins/managers keep full access via the
-- existing employees_can_read() helper; this only ADDS a per-row self clause.
--
-- A user still sees ONLY their own row (RLS is row-level), and only their own row's columns —
-- which is exactly "they see everything about themselves". Notes & documents are NOT in this
-- table; the app hides those tabs in the self-service view.
--
-- MANUAL RUN ONLY -- not auto-applied. Idempotent. Additive: recreates one SELECT policy.
-- Pure ASCII (copy/pastes cleanly into the Supabase SQL editor).

DROP POLICY IF EXISTS "employees_read" ON public.employees;
CREATE POLICY "employees_read" ON public.employees
  FOR SELECT TO authenticated
  USING (
    public.employees_can_read()
    OR lower(work_email) = lower(COALESCE(
      (SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()),
      ''
    ))
  );

-- Done. Non-admins can now read (only) their own employee row, matched by work_email = their
-- login email. If a user's login email differs from their BambooHR work email, no row matches
-- and the app shows a "profile not linked" message (no data is leaked).
