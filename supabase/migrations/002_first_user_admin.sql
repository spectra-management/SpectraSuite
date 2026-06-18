-- ============================================================================
-- Spectra Suite — 002: guarantee the FIRST user becomes super_admin
-- ============================================================================
--
-- HOW TO RUN: paste this whole file into Supabase Dashboard → SQL Editor → Run
-- (or `supabase db push`). It is idempotent and safe to re-run.
--
-- Why a DB function instead of a client UPDATE: the profiles RLS policies only
-- allow a super_admin to modify profiles, so a brand-new 'viewer' cannot promote
-- itself from the client. The SECURITY DEFINER function below runs with elevated
-- rights server-side and self-limits to "only the first user, only when no
-- super_admin exists yet", which is safe to expose to authenticated callers.
-- ============================================================================

-- 1) One-time backfill: promote the earliest existing user if there's no
--    super_admin yet (covers users who signed up before this logic existed).
UPDATE public.profiles
SET role = 'super_admin', updated_at = NOW()
WHERE id = (SELECT id FROM public.profiles ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'super_admin');

-- 2) Ensure every super_admin has ALL module permissions (idempotent).
INSERT INTO public.user_module_permissions (user_id, module, can_view, can_edit, can_approve, can_admin)
SELECT p.id, m.module, true, true, true, true
FROM public.profiles p
CROSS JOIN (VALUES ('nomina'), ('rrhh'), ('facturacion'), ('gastos'), ('it')) AS m(module)
WHERE p.role = 'super_admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_module_permissions ump
    WHERE ump.user_id = p.id AND ump.module = m.module
  );

-- 3) RLS-safe bootstrap callable from the client right after login.
CREATE OR REPLACE FUNCTION public.claim_super_admin_if_first()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  admin_count int;
  first_id uuid;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  -- No-op the moment any super_admin exists.
  SELECT count(*) INTO admin_count FROM public.profiles WHERE role = 'super_admin';
  IF admin_count > 0 THEN RETURN; END IF;

  -- Only the earliest-created profile may claim it.
  SELECT id INTO first_id FROM public.profiles ORDER BY created_at ASC LIMIT 1;
  IF first_id IS DISTINCT FROM uid THEN RETURN; END IF;

  UPDATE public.profiles SET role = 'super_admin', updated_at = NOW() WHERE id = uid;

  -- Grant access to ALL modules (only if none granted yet).
  IF NOT EXISTS (SELECT 1 FROM public.user_module_permissions WHERE user_id = uid) THEN
    INSERT INTO public.user_module_permissions (user_id, module, can_view, can_edit, can_approve, can_admin)
    VALUES
      (uid, 'nomina', true, true, true, true),
      (uid, 'rrhh', true, true, true, true),
      (uid, 'facturacion', true, true, true, true),
      (uid, 'gastos', true, true, true, true),
      (uid, 'it', true, true, true, true);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_super_admin_if_first() TO authenticated;

-- 4) Update the signup trigger: first user → super_admin AND auto-granted all
--    module permissions at creation time.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_count INTEGER;
  assigned_role TEXT;
BEGIN
  SELECT COUNT(*) INTO existing_count FROM public.profiles;
  assigned_role := CASE WHEN existing_count = 0 THEN 'super_admin' ELSE 'viewer' END;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    assigned_role
  );

  IF assigned_role = 'super_admin' THEN
    INSERT INTO public.user_module_permissions (user_id, module, can_view, can_edit, can_approve, can_admin)
    VALUES
      (NEW.id, 'nomina', true, true, true, true),
      (NEW.id, 'rrhh', true, true, true, true),
      (NEW.id, 'facturacion', true, true, true, true),
      (NEW.id, 'gastos', true, true, true, true),
      (NEW.id, 'it', true, true, true, true);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
