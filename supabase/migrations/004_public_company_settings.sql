-- ============================================================================
-- Spectra Suite — 004: allow public (unauthenticated) reads of company_settings
-- ============================================================================
--
-- HOW TO RUN: paste into Supabase Dashboard → SQL Editor → Run. Safe to re-run.
--
-- WHY: the login page renders BEFORE the user authenticates, so it can't read
-- company_settings under the old "authenticated only" SELECT policy — the
-- company logo/name never load on /login. The logo is stored as a base64 data
-- URL in company_settings.logo_url (no Supabase Storage bucket involved), so the
-- only fix needed is to make the row's branding fields publicly readable.
--
-- Note: company_settings holds only non-sensitive branding (name, RNC, address,
-- phone, logo, colors). Writes remain restricted to super_admins (migration 003).
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Anyone can read company settings" ON public.company_settings;
CREATE POLICY "Anyone can read company settings" ON public.company_settings
  FOR SELECT USING (true);
