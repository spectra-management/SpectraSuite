-- 011_documentos_module.sql
--
-- Registers the new "documentos" (company documents) module at the database level.
-- MANUAL RUN ONLY -- not auto-applied. Idempotent and additive: it only RELAXES three
-- CHECK constraints so 'documentos' becomes a valid value. It creates NO tables and
-- drops NO data.
--
-- Why no new tables: the Documentos module persists its templates and generated-document
-- records through the generic app_state KV table created in migration 010
-- (keys 'document_templates' and 'generated_documents'). So the ONLY schema change needed
-- to support per-role/per-user 'documentos' permissions is widening the module CHECK
-- constraints (and the audit category CHECK for document audit events).
--
-- Note: super_admin and module_admin can already use the module WITHOUT this migration
-- (they bypass per-module permission rows in app code). This migration is required only to
-- GRANT documentos access to granular custom roles / per-user permissions, and to let
-- document audit events be recorded under the 'documentos' category.
--
-- Pure ASCII on purpose (copy/pastes cleanly into the Supabase SQL editor).

-- 1. Allow 'documentos' in per-user module permissions (constraint from migration 001).
DO $$
BEGIN
  IF to_regclass('public.user_module_permissions') IS NOT NULL THEN
    ALTER TABLE public.user_module_permissions DROP CONSTRAINT IF EXISTS user_module_permissions_module_check;
    ALTER TABLE public.user_module_permissions ADD CONSTRAINT user_module_permissions_module_check
      CHECK (module IN ('nomina','rrhh','facturacion','documentos','gastos','it'));
  END IF;
END
$$;

-- 2. Allow 'documentos' in role permissions (constraint from migration 006).
DO $$
BEGIN
  IF to_regclass('public.role_permissions') IS NOT NULL THEN
    ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_module_check;
    ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_module_check
      CHECK (module IN ('nomina','rrhh','facturacion','documentos','gastos','it'));
  END IF;
END
$$;

-- 3. Allow 'documentos' audit events (constraint last set in migration 009).
DO $$
BEGIN
  IF to_regclass('public.audit_log') IS NOT NULL THEN
    ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_category_check;
    ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_category_check
      CHECK (category IN ('auth','user_management','payroll','vacation','settings','connector','facturacion','documentos'));
  END IF;
END
$$;

-- Done. Templates + generated-document records ride on app_state (migration 010); make sure
-- 010 has been run so they persist to the cloud (otherwise the module still works fully from
-- localStorage, offline-first).
