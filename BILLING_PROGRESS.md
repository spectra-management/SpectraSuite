# BILLING_PROGRESS.md — Facturación (Billing/Invoicing) Module

Branch: `feature/billing-module` (off `main`). Commits **local only** — no push/merge/deploy.

## Status — ALL priority items complete ✅

| # | Priority item | Status |
|---|---------------|--------|
| (a) | Clients + employee assignment + title/title-rate + per-employee override | ✅ Done |
| (b) | Billing computation (hour / fixed / percentage) from finalized Payroll hours | ✅ Done |
| (c) | Base Pay / Overtime separate lines + manual bonus/incentive lines | ✅ Done |
| (d) | On-screen billing report (invoice preview) + invoice PDF | ✅ Done |
| (e) | Reports suite (revenue by month/client/type, billed hours, CSV export) | ✅ Done |
| (f) | Module dashboard | ✅ Done |

Build green (`npm run build`), typecheck green, import boundaries green
(`npm run lint:imports`), 107/107 tests pass (18 new billing tests).
> `npm run lint` (ESLint) fails project-wide with "couldn't find a configuration
> file" — this is a **pre-existing** repo state (no `.eslintrc`/`eslint.config.*`),
> unrelated to this module.

## How Payroll data is read (the ONLY bridge)

Per IMPORT_RULES, the billing module **never imports `@/modules/nomina`**. A new
shared accessor was created:

- **`src/shared/lib/payrollData.ts`** — reads finalized payroll runs from the same
  `spectra_payroll_history` localStorage key the payroll store persists to, and
  exposes a billing-oriented surface. `shared/lib` stays store-agnostic, so it reads
  via the storage abstraction (not the Zustand payroll store).

Key decisions documented in that file:
- **"Finalized / paid"** = payroll run `status ∈ {approved, sent}`. `draft` is never
  billable. (`approved` = verified, `sent` = paystubs distributed/paid.)
- **Hours split**: `baseHours = regularHours`; `overtimeHours = otHours + holidayHours`
  (both billed at the overtime rate). If holiday ever needs its own rate, split there.
- **Pay basis** for the percentage method: `grossPay` (total earnings = labor cost).
  `netPay` is also exposed.

## Billing model implemented

- **Clients** (`billing_clients`): name, contact, billing address, remit-to info,
  invoice prefix (e.g. "RM"), default method, single currency, active flag.
  Invoice numbers: `PREFIX-0001` (zero-padded, per-client sequence advanced on finalize).
- **Client employees**: assign roster employees (from `@/shared/store/employeesStore`,
  fed by BambooHR) to a client; the assignment UI shows each employee's **job title**.
- **Rate resolution priority**: per-employee override → title rate (base) → 0.
  Method: per-employee override → client default.
- **Methods**: `hour` (rate × hours), `fixed` (flat per employee), `percentage`
  (rate% × finalized gross pay).
- **Base Pay vs Overtime**: the `hour` method emits **two separate line items**
  ("Base Pay" and "Overtime Differential") with their own hours and rate, matching
  the company's real invoice.
- **Bonus / incentive lines**: manual per-employee lines (label, quantity, amount)
  added on the invoice; they add to the total. Previously-used labels are remembered
  and offered as `<datalist>` suggestions.
- **Invoice lifecycle**: `draft` (editable, no number) → `finalize` (assigns number,
  locks). PDF can be downloaded in either state (draft shows "Draft" instead of a #).

## RBAC (reuses Suite-wide `hasModuleAccess`, no parallel system)

Defined in `src/modules/facturacion/lib/permissions.ts`:

| Capability | Check | Notes |
|-----------|-------|-------|
| View billing (clients, invoices, on-screen report, dashboard) | `hasModuleAccess('facturacion', 'view')` | Route gate + UI |
| Edit clients / rates / overrides / assignments / invoices / bonus / finalize | `hasModuleAccess('facturacion', 'edit')` | `/invoices/new` route also gated to `edit` |
| Read employee **PAY** (percentage method) + **financial reports** | `hasModuleAccess('facturacion', 'admin')` | **Stronger** check, per brief |

- `super_admin` and legacy `module_admin` bypass everything (as elsewhere).
- The percentage method multiplies a rate by finalized payroll **pay** (sensitive
  cross-employee compensation), so the New-Invoice preview and the whole Reports page
  are gated behind `admin`. If `admin` proves too strict, relax to `'approve'` in
  `permissions.ts` (single source of truth).

## Audit events (category `facturacion`)

`src/modules/facturacion/lib/audit.ts` (best-effort wrappers over the shared logger):
`client_created`, `client_updated`, `rate_changed`, `invoice_generated`,
`invoice_finalized`, `bonus_added`.

> Added `'facturacion'` to the `AuditCategory` TS union (`shared/types/supabase.ts`).
> The DB `audit_log.category` CHECK constraint (migration 005) does **not** yet allow
> it — the logger swallows the error, so the UI is unaffected, but billing audit rows
> won't persist until migration **009** relaxes the constraint. (Provided, manual run.)

## Files created

```
src/shared/lib/payrollData.ts                         # finalized-payroll accessor (the bridge)
src/shared/lib/storage.ts                             # +5 BILLING_* storage keys
src/shared/types/supabase.ts                          # +'facturacion' AuditCategory
src/shared/lib/suiteModules.ts                        # facturacion active:true + nav
src/App.tsx                                            # /facturacion routes
src/locales/{en,es}.json                              # facturacion.* + suite.nav.dashboard

src/modules/facturacion/
├── index.ts                                          # public barrel
├── lib/
│   ├── types.ts                                      # domain types
│   ├── rates.ts                                      # rate resolution (override > title)
│   ├── compute.ts                                    # finalized hours → line items
│   ├── reports.ts                                    # report aggregations + CSV
│   ├── permissions.ts                                # useBillingAccess (RBAC)
│   ├── audit.ts                                      # billing audit wrappers
│   ├── invoiceNumber.ts                              # PREFIX-0001 formatting
│   ├── format.ts                                     # PDF-safe currency + hours
│   ├── pdf.ts                                         # lazy react-pdf helpers
│   ├── invoicePdf.tsx                                # invoice <Document>
│   └── __tests__/billing.test.ts                     # 18 tests
├── store/billingStore.ts                             # zustand + localStorage
├── components/
│   ├── BillingLayout.tsx · BillingSidebar.tsx · BillingPageHeader.tsx · BillingStates.tsx
│   ├── ClientFormDialog.tsx · AssignmentOverrideDialog.tsx · BonusLineDialog.tsx
└── pages/
    ├── Dashboard/ · Clients/ · ClientDetail/ · Invoices/ · NewInvoice/ · InvoiceDetail/ · Reports/

supabase/migrations/009_billing_module.sql            # FORWARD-LOOKING, manual run only
```

## Persistence

Like the rest of the Suite today, billing persists to **localStorage** via the shared
`storage` abstraction (keys `spectra_billing_*`). `009_billing_module.sql` is the
target Postgres schema (tables + RLS via a `billing_can()` helper + audit-category
fix) for the eventual migration — **not auto-applied**.

## Guardrails honored
- New branch off `main`; local commits only (no push/merge/deploy).
- Module lives in `src/modules/facturacion/`; imports only from `@/shared` — verified
  by `npm run lint:imports` (no cross-module imports, no cycles).
- Payroll untouched: no files under `src/modules/nomina/**` modified; all 89 existing
  tests still pass. Payroll data read only through the shared accessor, using the
  hours/pay Payroll **finalized**.
- Dark mode + ES/EN (zero hardcoded user-facing strings), shadcn/ui + shared components.
```
