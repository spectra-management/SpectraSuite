-- 013_employee_photo_source.sql
--
-- Make employee photos DURABLE: a BambooHR sync now downloads each photo and stores it in
-- the private `employee-photos` bucket (one row per employee in rrhh_employee_photos), so
-- avatars load from the DATABASE instead of re-fetching from BambooHR on every page visit.
--
-- Two new columns let the sync be idempotent and respect manual uploads:
--   source           - 'manual' (admin-uploaded) or 'bamboohr' (synced). The sync NEVER
--                      overwrites a 'manual' row; a manual upload always wins.
--   bamboohr_version - the BambooHR photo version (the path segment of photoUrl, e.g.
--                      "116-0-4.jpg"). The sync re-downloads ONLY when this changes, so an
--                      unchanged photo is never re-stored.
--
-- MANUAL RUN ONLY -- not auto-applied. Idempotent (ADD COLUMN IF NOT EXISTS). Additive:
-- adds two columns to an existing table, drops no data. Existing rows are manual uploads,
-- so the default 'manual' is correct for them.
--
-- Pure ASCII on purpose (copy/pastes cleanly into the Supabase SQL editor).

ALTER TABLE public.rrhh_employee_photos
  ADD COLUMN IF NOT EXISTS source           TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS bamboohr_version TEXT;
