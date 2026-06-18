-- ============================================================================
-- Spectra Suite — Initial schema (Auth + Supabase integration)
-- ============================================================================
--
-- HOW TO RUN THIS MIGRATION
-- -------------------------
-- Option A — Supabase Dashboard (easiest):
--   1. Open https://supabase.com/dashboard/project/gjjgvnofemjwesjuadbe
--   2. Go to "SQL Editor" → "New query"
--   3. Paste the entire contents of this file and click "Run".
--
-- Option B — Supabase CLI:
--   1. npm install -g supabase   (or use npx)
--   2. supabase login
--   3. supabase link --project-ref gjjgvnofemjwesjuadbe
--   4. supabase db push
--
-- AFTER RUNNING:
--   - Enable Google provider: Dashboard → Authentication → Providers → Google.
--     Set the Google OAuth Client ID + Secret, and add the redirect URL
--     (https://<your-domain>/suite and http://localhost:5173/suite for dev).
--   - In Google Cloud Console, enable the "Google Tasks API" and
--     "Google Calendar API" for the same OAuth client (needed for the
--     Suite Dashboard Tasks + Calendar widgets — see src/lib/google.ts).
--
-- This script is idempotent-friendly: it uses IF NOT EXISTS / DROP ... IF EXISTS
-- where practical so it can be re-run during development without errors.
-- ============================================================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('super_admin', 'module_admin', 'viewer', 'custom')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Module permissions per user
CREATE TABLE IF NOT EXISTS public.user_module_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN ('nomina', 'rrhh', 'facturacion', 'gastos', 'it')),
  can_view BOOLEAN DEFAULT true,
  can_edit BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  can_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Company settings (moved from localStorage to Supabase)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT,
  rnc TEXT,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#059669',
  secondary_color TEXT DEFAULT '#047857',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integration credentials (API keys stored securely)
CREATE TABLE IF NOT EXISTS public.integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL CHECK (name IN ('bamboohr', 'hubstaff', 'resend')),
  credentials JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll history
CREATE TABLE IF NOT EXISTS public.payroll_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pay_date DATE,
  country TEXT NOT NULL,
  frequency TEXT NOT NULL,
  fortnight TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'approved', 'sent')),
  total_gross DECIMAL(12,2),
  total_deductions DECIMAL(12,2),
  total_net DECIMAL(12,2),
  employee_count INTEGER,
  created_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vacation payments
CREATE TABLE IF NOT EXISTS public.vacation_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  bamboohr_employee_id TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  year INTEGER NOT NULL,
  entitled_days INTEGER NOT NULL,
  daily_salary DECIMAL(12,2),
  gross_amount DECIMAL(12,2),
  sfs_amount DECIMAL(12,2),
  afp_amount DECIMAL(12,2),
  isr_amount DECIMAL(12,2),
  net_amount DECIMAL(12,2),
  isr_applied_in_period TEXT,
  vacation_start DATE,
  vacation_end DATE,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles" ON public.profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);
DROP POLICY IF EXISTS "Users can view own permissions" ON public.user_module_permissions;
CREATE POLICY "Users can view own permissions" ON public.user_module_permissions FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Super admins manage permissions" ON public.user_module_permissions;
CREATE POLICY "Super admins manage permissions" ON public.user_module_permissions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);
DROP POLICY IF EXISTS "Authenticated users can read company settings" ON public.company_settings;
CREATE POLICY "Authenticated users can read company settings" ON public.company_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Super admins manage company settings" ON public.company_settings;
CREATE POLICY "Super admins manage company settings" ON public.company_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);
DROP POLICY IF EXISTS "Authenticated users read integrations" ON public.integrations;
CREATE POLICY "Authenticated users read integrations" ON public.integrations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Super admins manage integrations" ON public.integrations;
CREATE POLICY "Super admins manage integrations" ON public.integrations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin')
);
DROP POLICY IF EXISTS "Authenticated users read payroll" ON public.payroll_runs;
CREATE POLICY "Authenticated users read payroll" ON public.payroll_runs FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Nomina admins manage payroll" ON public.payroll_runs;
CREATE POLICY "Nomina admins manage payroll" ON public.payroll_runs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'module_admin'))
);
-- Vacation payments: authenticated users may read; nomina/super admins manage.
DROP POLICY IF EXISTS "Authenticated users read vacation payments" ON public.vacation_payments;
CREATE POLICY "Authenticated users read vacation payments" ON public.vacation_payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Nomina admins manage vacation payments" ON public.vacation_payments;
CREATE POLICY "Nomina admins manage vacation payments" ON public.vacation_payments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'module_admin'))
);

-- Auto-create profile on signup.
-- The FIRST user to ever sign up becomes super_admin automatically; everyone
-- after that defaults to 'viewer' (per Part 4 requirement). Running inside the
-- SECURITY DEFINER trigger means this bypasses RLS safely server-side.
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
