# PERSISTENCE_FIX_PROGRESS.md — Cloud-authoritative business data

Branch: `feature/cloud-persistence` (off `main`). Commits **local only** — no push/merge/deploy.
Fixes the data-loss described in `DATA_PERSISTENCE_AUDIT.md`.

## Status

| # | Item | Status |
|---|------|--------|
| 1 | Connector auto-restore on login (read-back) | ✅ Done |
| 2 | Payroll history → cloud-authoritative | ✅ Done |
| 3 | Vacations → cloud-authoritative | ✅ Done |
| 4 | Billing → cloud-authoritative | ⛔ **Blocked** — billing module is not on `main` (lives on the unmerged `feature/billing-module` branch). Pattern + instructions documented below. |
| 5 | One-time localStorage → cloud migration | ✅ Done (built into each read-back) |
| 6 | Fix the timeout `localStorage.clear()` | ✅ Done |

Verification: `npm run typecheck` clean · `npm run build` clean · `npm run lint:imports`
clean (no cross-module imports, no cycles) · **104/104 tests pass** (89 pre-existing on
`main` + 15 new; no regressions). ESLint remains unconfigured project-wide (pre-existing).

> Test-count note: the brief's "107" baseline was measured on the billing branch. This
> branch is off `main`, which has 89 tests; this change adds 15 → 104.

---

## Design (offline-first preserved; cloud becomes the durable source of truth)

localStorage stays the fast local cache and the app still works fully offline. On login
the app **reads business data back from Supabase** and merges **cloud-wins**, so data
survives deploys, domain changes, new devices, and localStorage clears. Every cloud
write is **best-effort** (guarded by auth + try/catch) and **never throws**; if Supabase
is unreachable the app silently keeps using localStorage and re-syncs later.

### Conflict-resolution rule (everywhere): **cloud wins**
- Same record in both places → the **cloud** copy is kept (durable source of truth).
- Record only local → kept locally **and** uploaded (one-time migration of existing data).
- Record only in cloud → restored locally (the read-back that fixes the loss).

### Per-data-type wiring

| Data | Written to | On what event | Read back from | On what event |
|------|-----------|---------------|----------------|---------------|
| **BambooHR / Hubstaff connectors** | `integrations` table (existing writer) | `updateBambooHR` / `updateHubstaff` | `integrations` (NEW read-back) | login → `settingsStore.hydrateConnectorsFromCloud()` (called in `AuthContext.applySession`) |
| **Payroll history** | `payroll_runs` table — full object in new `data` JSONB col + summary cols, conflict key `local_id` | `addPayroll`/`updatePayroll` when status ∈ {approved, sent} | `payroll_runs.data` | login → `payrollStore.hydrateFromCloud()` |
| **Vacation payments made** | `app_state` KV (key `vacation_payments_made`) | `markPaid` | `app_state` | login → `vacationPaymentsStore.hydrateFromCloud()` |
| **Pending vacation ISR** | `app_state` KV (key `pending_vacation_isr`) | `setPending`/`markApplied` | `app_state` | login → `pendingVacationIsrStore.hydrateFromCloud()` |
| **Company settings** | `company_settings` (already existed) | `updateCompany` | `company_settings` (already existed) | login (unchanged) |

Why `app_state` (a generic KV) for vacations instead of the relational `vacation_payments`
table: the vacation stores are **nested maps** (`{employeeId: {year: payment}}` and
`{employeeId: record}`) with no `employee_name`/per-row grain, so forcing them into the
relational table would be lossy. A JSONB blob keyed by the store's localStorage key
round-trips **losslessly** — the safest option for real business data. Documented as a
deliberate deviation from the brief's table suggestion.

Why `payroll_runs` keeps a `data` JSONB column: the app's run id (`generateId()`) is **not
a UUID**, so it can't be the table's UUID primary key; it goes in a new `local_id` column
(the upsert conflict target), and the canonical `PayrollPeriod` (entries + totals) lives in
`data` so paystubs/reports round-trip with full fidelity. Summary columns
(period, status, totals, employee_count) are mirrored for queryability.

### Migration of existing localStorage data (item 5)
Built into each `hydrateFromCloud`:
- If the cloud has data → merge cloud-wins and **upload local-only** records.
- If the cloud is empty → **push existing local** records up (first-run migration).
- Payroll only uploads **finalized** (approved/sent) runs; drafts stay local until finalized.
No destructive operation: nothing local is deleted, only merged/uploaded.

### Timeout fix (item 6)
`AuthContext.handleSessionExpired` no longer calls the native `localStorage.clear()`
(which wiped ALL business data on every inactivity timeout). It now calls
`clearAuthSessionKeys()` (`src/shared/lib/sessionReset.ts`), which removes **only**:
- `google_provider_token`, `google_provider_refresh_token`
- Supabase session keys (`sb-*`) — `supabase.auth.signOut()` already clears these; we sweep defensively.

**Preserved** on timeout: every `spectra_*` business cache (employees, payroll history,
settings, connectors, vacations, …), `theme`, `sidebar_collapsed`. Safe because business
data is now cloud-authoritative and re-hydrated on the next login regardless.

---

## RLS / permissions (important)
Read-back works for **all authenticated users** (existing SELECT policies on
`integrations`, `payroll_runs`, and the new `app_state` allow authenticated reads). Cloud
**writes** are gated to `super_admin` / `module_admin` (existing policy on `payroll_runs`,
`super_admin` on `integrations`, and the new `app_state` policy mirrors payroll/vacation).
Non-privileged users therefore **restore** data from the cloud but their best-effort writes
no-op — matching the app's pre-existing behavior. Documented so this is expected, not a bug.

---

## SQL the user must run manually (NOT auto-applied)
`supabase/migrations/010_cloud_persistence.sql` — idempotent, additive, touches no existing
rows. Until it is run, all cloud writes best-effort no-op and the app keeps using
localStorage. It:
1. Adds `payroll_runs.local_id TEXT` + `payroll_runs.data JSONB` + a unique index on `local_id`.
2. Creates `app_state (key TEXT PK, value JSONB, updated_at)` with RLS (authenticated read;
   super_admin/module_admin write).

Connectors need **no** schema change — `integrations` already exists; this release adds the
missing read-back in app code.

---

## Files changed

```
NEW  src/shared/lib/cloudMerge.ts                         # pure merge helpers (cloud-wins, connector mapping)
NEW  src/shared/lib/sessionReset.ts                       # clearAuthSessionKeys() for the timeout
MOD  src/shared/lib/cloudSync.ts                          # + fetchConnectorConfigs, savePayrollRunCloud,
                                                          #   fetchPayrollRunsCloud, saveAppState, fetchAppState
MOD  src/shared/store/settingsStore.ts                    # + hydrateConnectorsFromCloud()
MOD  src/shared/store/payrollStore.ts                     # cloud write on finalize + hydrateFromCloud()
MOD  src/shared/store/vacationPaymentsStore.ts            # cloud mirror + hydrateFromCloud()
MOD  src/shared/store/pendingVacationIsrStore.ts          # cloud mirror + hydrateFromCloud()
MOD  src/shared/context/AuthContext.tsx                   # call hydrators on login; timeout clears only session keys
MOD  src/test/setup.ts                                    # localStorage mock: add length/key (browser-faithful)
NEW  src/shared/lib/__tests__/cloudMerge.test.ts          # 11 tests
NEW  src/shared/store/__tests__/cloudPersistence.store.test.ts  # 4 tests
NEW  supabase/migrations/010_cloud_persistence.sql        # manual run
```

No files under `src/modules/nomina/**` were modified; the payroll **engine** is untouched —
only the shared persistence layer changed.

---

## Item 4 (Billing) — blocked, with the exact recipe to finish it

The billing module (`src/modules/facturacion/**`, `billingStore`, migration 009) exists on
`feature/billing-module`, **not on `main`**, so it can't be wired here. When that branch is
merged, apply the identical pattern (a module-local cloud sync respecting IMPORT_RULES —
billing types are module-private, so the sync lives **in the module**, importing only
`@/shared/lib/supabase`):

1. Add `src/modules/facturacion/lib/cloudSync.ts` with upsert/fetch for `billing_clients`,
   `billing_title_rates`, `billing_client_employees`, `billing_invoices` (009 tables already
   match the types; these have real columns, so no `data` blob needed).
2. In `billingStore`, mirror each mutation (best-effort) and add `hydrateFromCloud()` that
   merges cloud-wins by id and uploads local-only rows.
3. Trigger `hydrateFromCloud()` when the billing module mounts (`BillingLayout` effect) —
   keeps the boundary clean (AuthContext must not import a module).
4. Migration 009 must be applied for billing tables to exist (best-effort writes no-op otherwise).

---

## Offline-safety guarantees (unchanged behavior if Supabase is down)
- All cloud reads/writes are guarded by `isAuthenticated()` + try/catch and never throw.
- `hydrateFromCloud` with an unreachable cloud returns the empty/null path → local cache kept.
- The app renders and mutates entirely from localStorage when offline; the next successful
  login re-syncs.
