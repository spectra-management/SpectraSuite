-- 009_billing_module.sql
--
-- Billing (facturacion) module schema -- FORWARD-LOOKING / MANUAL RUN ONLY.
--
-- IMPORTANT: As with the rest of the Suite today, the billing module persists to
-- localStorage (see src/modules/facturacion/store/billingStore.ts), NOT to these
-- tables. This migration is provided for the eventual Supabase migration and is NOT
-- applied automatically. Run it by hand when billing moves to Postgres. It is written
-- defensively (IF NOT EXISTS / idempotent) so a manual run is safe.
--
-- RBAC: SELECT requires facturacion 'view'; writes require 'edit'. The percentage
-- method's pay readout and the financial reports are gated to 'admin' IN THE APP
-- (src/modules/facturacion/lib/permissions.ts) -- RLS here enforces view/edit only.
--
-- NOTE: this file is intentionally pure ASCII so it copy/pastes cleanly into the
-- Supabase SQL editor. Do not add box-drawing or accented characters.

-- 0. Relax the audit_log category CHECK to allow billing events.
--    (Migration 005 created the constraint without 'facturacion'.)
DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_category_check;
    ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_category_check
      CHECK (category IN ('auth','user_management','payroll','vacation','settings','connector','facturacion'));
  END IF;
END
$$;

-- 1. Permission helper (aggregates legacy + role perms for facturacion).
--    Mirrors the app's hasModuleAccess('facturacion', action). super_admin and
--    legacy module_admin bypass. action is one of 'view', 'edit', 'admin'.
CREATE OR REPLACE FUNCTION public.billing_can(p_action TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'module_admin')
    OR EXISTS (
      -- legacy per-user module permissions
      SELECT 1 FROM public.user_module_permissions ump
      WHERE ump.user_id = auth.uid() AND ump.module = 'facturacion'
        AND ((p_action = 'view'  AND ump.can_view)
          OR (p_action = 'edit'  AND ump.can_view AND ump.can_edit)
          OR (p_action = 'admin' AND ump.can_admin))
    )
    OR EXISTS (
      -- role-based permissions
      SELECT 1
      FROM public.user_roles ur
      JOIN public.role_permissions rp ON rp.role_id = ur.role_id
      WHERE ur.user_id = auth.uid() AND rp.module = 'facturacion'
        AND ((p_action = 'view'  AND rp.can_view)
          OR (p_action = 'edit'  AND rp.can_view AND rp.can_edit)
          OR (p_action = 'admin' AND rp.can_admin))
    );
$$;

-- 2. Tables.
CREATE TABLE IF NOT EXISTS public.billing_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  billing_address TEXT DEFAULT '',
  remit_to_name TEXT DEFAULT '',
  remit_to_address TEXT DEFAULT '',
  remit_to_details TEXT DEFAULT '',
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  next_invoice_seq INTEGER NOT NULL DEFAULT 1,
  default_method TEXT NOT NULL DEFAULT 'hour',
  currency_country TEXT NOT NULL DEFAULT 'Dominican Republic',
  notes TEXT DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_clients_default_method_check
    CHECK (default_method IN ('hour','fixed','percentage'))
);

CREATE TABLE IF NOT EXISTS public.billing_title_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.billing_clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  base_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  ot_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_title_rates_unique UNIQUE (client_id, title)
);

CREATE TABLE IF NOT EXISTS public.billing_client_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.billing_clients(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  method TEXT,
  base_rate_override NUMERIC(12,2),
  ot_rate_override NUMERIC(12,2),
  fixed_amount NUMERIC(12,2),
  percentage_rate NUMERIC(6,2),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_client_employees_method_check
    CHECK (method IS NULL OR method IN ('hour','fixed','percentage')),
  CONSTRAINT billing_client_employees_unique UNIQUE (client_id, employee_id)
);

CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.billing_clients(id) ON DELETE RESTRICT,
  number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  payroll_run_ids TEXT[] NOT NULL DEFAULT '{}',
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency_country TEXT NOT NULL DEFAULT 'Dominican Republic',
  notes TEXT DEFAULT '',
  issue_date DATE NOT NULL,
  client_name_snapshot TEXT DEFAULT '',
  finalized_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_invoices_status_check CHECK (status IN ('draft','finalized'))
);

CREATE INDEX IF NOT EXISTS idx_billing_title_rates_client ON public.billing_title_rates(client_id);
CREATE INDEX IF NOT EXISTS idx_billing_client_employees_client ON public.billing_client_employees(client_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_client ON public.billing_invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON public.billing_invoices(status);

-- 3. Row Level Security.
ALTER TABLE public.billing_clients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_title_rates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_client_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_invoices         ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['billing_clients','billing_title_rates','billing_client_employees','billing_invoices']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "billing_view" ON public.%I', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "billing_edit" ON public.%I', tbl);
    -- SELECT for anyone with facturacion view
    EXECUTE format($f$CREATE POLICY "billing_view" ON public.%I FOR SELECT TO authenticated USING (public.billing_can('view'))$f$, tbl);
    -- INSERT/UPDATE/DELETE for facturacion edit
    EXECUTE format($f$CREATE POLICY "billing_edit" ON public.%I FOR ALL TO authenticated USING (public.billing_can('edit')) WITH CHECK (public.billing_can('edit'))$f$, tbl);
  END LOOP;
END
$$;

-- Done. Remember: the app currently reads/writes localStorage; this schema is the
-- target for when billing data is migrated to Postgres.
