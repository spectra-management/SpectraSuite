# Documentos Module — Build Progress

Branch: `feature/documentos-module`

## Goal
New suite module "documentos": pick a template + employee(s), auto-fill from HR data
(BambooHR via shared connector), export a professional PDF, and keep a cloud record.

## Decisions (from user)
- Templates: predefined + editable, with `{{variables}}`.
- Selection: individual + bulk (one / several / by department / all).
- Output: download PDF + save cloud record (NO email in v1).
- Employee data: create a SHARED HR connector so cédula/address/phone/DOB are fillable.

## Architecture
- Module-local store (like facturacion `billingStore`) → no AuthContext/cloudSync edits.
- Persistence via existing `app_state` KV (migration 010): keys `document_templates`,
  `generated_documents`. Offline-first, best-effort cloud (super_admin/module_admin write).
- Shared PDF helper `@/shared/lib/pdf` (Helvetica, Latin-1 covers Spanish) — reusable.
- Shared HR connector `@/shared/connectors/bamboohr-hr` (rich BambooHR fields).
- New SQL migration `011_documentos_module.sql`: relax module CHECK (user_module_permissions,
  role_permissions) + audit category CHECK to include 'documentos'. MANUAL RUN. Templates/
  records reuse app_state (no new table).

## Checklist
### Shared foundations
- [ ] src/shared/lib/storage.ts — add DOCUMENT_TEMPLATES, GENERATED_DOCUMENTS keys
- [ ] src/shared/lib/pdf/index.ts — generatePdfBlob + downloadBlob (shared)
- [ ] src/shared/connectors/bamboohr-hr.ts — fetchHrDirectory (rich fields) + HrEmployeeDetail
- [ ] src/shared/types/supabase.ts — ModuleId += documentos; AuditCategory += documentos

### Module (src/modules/documentos/)
- [ ] lib/types.ts — DocumentTemplate, GeneratedDocumentRecord, TemplateVariable
- [ ] lib/variables.ts — variable catalog + fillTemplate + buildVariables
- [ ] lib/seedTemplates.ts — 4 ES defaults (contrato, carta laboral, NDA, amonestación)
- [ ] lib/ContractDocument.tsx — @react-pdf document component
- [ ] store/documentsStore.ts — Zustand + app_state cloud sync + hydrate
- [ ] components/DocumentosLayout.tsx, DocumentosSidebar.tsx
- [ ] pages/Templates (list+editor), pages/Generate (pick+fill+pdf), pages/History (records)
- [ ] index.ts — barrel

### Registration
- [ ] suiteModules.ts (SuiteModuleId + entry)
- [ ] AuthContext MODULES
- [ ] moduleIcons.ts
- [ ] RolesPanel + UsersPanel MODULES
- [ ] App.tsx routes
- [ ] i18n en.json + es.json (suite.modules.documentos, suite.nav.*, documentos.*)

### SQL + verify
- [ ] supabase/migrations/011_documentos_module.sql
- [ ] tests for fillTemplate / variables
- [ ] build, typecheck, lint, check:imports, test:run

## Risk
HIGH (new module, RBAC ModuleId, SQL migration). Do NOT merge — leave branch + SQL for user.
