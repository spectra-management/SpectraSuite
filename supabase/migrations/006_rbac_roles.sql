-- ============================================================================
-- Spectra Suite — 006: custom roles (RBAC) + multi-role assignment
-- ============================================================================
-- HOW TO RUN: paste into Supabase Dashboard → SQL Editor → Run. Idempotent.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  is_editable BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN ('nomina', 'rrhh', 'facturacion', 'gastos', 'it')),
  can_view BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  can_admin BOOLEAN DEFAULT false,
  UNIQUE(role_id, module)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage roles" ON public.roles;
CREATE POLICY "Super admins manage roles" ON public.roles FOR ALL USING (public.is_super_admin());
DROP POLICY IF EXISTS "Authenticated users view roles" ON public.roles;
CREATE POLICY "Authenticated users view roles" ON public.roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admins manage role permissions" ON public.role_permissions;
CREATE POLICY "Super admins manage role permissions" ON public.role_permissions FOR ALL USING (public.is_super_admin());
DROP POLICY IF EXISTS "Authenticated users view role permissions" ON public.role_permissions;
CREATE POLICY "Authenticated users view role permissions" ON public.role_permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admins manage user roles" ON public.user_roles;
CREATE POLICY "Super admins manage user roles" ON public.user_roles FOR ALL USING (public.is_super_admin());
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());

-- ── Seed system roles (idempotent by name) ───────────────────────────────────
INSERT INTO public.roles (name, description, is_system, is_editable)
SELECT v.name, v.description, v.is_system, v.is_editable
FROM (VALUES
  ('Super Admin', 'Full access to all modules and settings', true, false),
  ('Payroll Manager', 'Manage payroll processing, employees, and calculations', true, true),
  ('HR Manager', 'Manage employee records, departments, and attendance', true, true),
  ('Finance Director', 'Full access to billing, expenses, and financial reports', true, true),
  ('Payroll Viewer', 'View-only access to payroll reports and history', true, true),
  ('HR Viewer', 'View-only access to HR data', true, true)
) AS v(name, description, is_system, is_editable)
WHERE NOT EXISTS (SELECT 1 FROM public.roles r WHERE r.name = v.name);

-- ── Seed default permissions for system roles (idempotent via UNIQUE) ────────
-- Payroll Manager
INSERT INTO public.role_permissions (role_id, module, can_view, can_edit, can_approve, can_admin)
SELECT id, 'nomina', true, true, true, true FROM public.roles WHERE name = 'Payroll Manager'
ON CONFLICT (role_id, module) DO NOTHING;
INSERT INTO public.role_permissions (role_id, module, can_view, can_edit, can_approve, can_admin)
SELECT id, 'rrhh', true, false, false, false FROM public.roles WHERE name = 'Payroll Manager'
ON CONFLICT (role_id, module) DO NOTHING;

-- HR Manager
INSERT INTO public.role_permissions (role_id, module, can_view, can_edit, can_approve, can_admin)
SELECT id, 'rrhh', true, true, true, true FROM public.roles WHERE name = 'HR Manager'
ON CONFLICT (role_id, module) DO NOTHING;
INSERT INTO public.role_permissions (role_id, module, can_view, can_edit, can_approve, can_admin)
SELECT id, 'nomina', true, false, false, false FROM public.roles WHERE name = 'HR Manager'
ON CONFLICT (role_id, module) DO NOTHING;

-- Finance Director
INSERT INTO public.role_permissions (role_id, module, can_view, can_edit, can_approve, can_admin)
SELECT id, 'facturacion', true, true, true, true FROM public.roles WHERE name = 'Finance Director'
ON CONFLICT (role_id, module) DO NOTHING;
INSERT INTO public.role_permissions (role_id, module, can_view, can_edit, can_approve, can_admin)
SELECT id, 'gastos', true, true, true, true FROM public.roles WHERE name = 'Finance Director'
ON CONFLICT (role_id, module) DO NOTHING;
INSERT INTO public.role_permissions (role_id, module, can_view, can_edit, can_approve, can_admin)
SELECT id, 'nomina', true, false, false, false FROM public.roles WHERE name = 'Finance Director'
ON CONFLICT (role_id, module) DO NOTHING;

-- Payroll Viewer
INSERT INTO public.role_permissions (role_id, module, can_view, can_edit, can_approve, can_admin)
SELECT id, 'nomina', true, false, false, false FROM public.roles WHERE name = 'Payroll Viewer'
ON CONFLICT (role_id, module) DO NOTHING;

-- HR Viewer
INSERT INTO public.role_permissions (role_id, module, can_view, can_edit, can_approve, can_admin)
SELECT id, 'rrhh', true, false, false, false FROM public.roles WHERE name = 'HR Viewer'
ON CONFLICT (role_id, module) DO NOTHING;
