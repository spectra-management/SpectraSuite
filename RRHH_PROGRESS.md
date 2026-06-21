# RRHH (Human Resources) Module — Build Progress

> BambooHR-style HR module for Spectra Suite. Built autonomously on branch
> `feature/rrhh-bamboo-clone`. This file is updated **as work proceeds** so progress
> survives context loss.

**Status legend:** ✅ done & verified · 🟡 partial/stubbed · ⛔ blocked · ⬜ not started

---

## 0. Guardrails & Safety (CONFIRMED)

- ✅ `.claude/settings.json` created with the exact allow/deny permission set requested.
- ✅ Working only on branch `feature/rrhh-bamboo-clone` (created from clean `main`).
- ✅ **NEVER** ran `git push`, `git merge`, `vercel`, or any Supabase CLI/migration.
- ✅ All commits are **LOCAL** on the feature branch.
- ✅ **Every BambooHR call is READ-ONLY.** Only `GET /api/bamboohr` and
  `POST /api/bamboohr?path=/v1/reports/custom` are used. A custom report is a *read*
  operation (it generates a report from existing data; it does not mutate anything).
  No POST/PUT/PATCH/DELETE to any employee-mutating BambooHR endpoint. Confirmed again
  in the "BambooHR Read-Only Audit" section at the bottom.

---

## 1. Architecture & Key Decisions

The module lives in `src/modules/rrhh/`, imports only from `@/shared` and its own files
(per `src/IMPORT_RULES.md`), and never imports from another feature module.

### Decisions made (that I'd otherwise have asked about)

1. **Own connector, not Nómina's.** IMPORT_RULES forbids `modules/rrhh` importing from
   `modules/nomina`. So RRHH gets its **own** read-only BambooHR connector in
   `src/modules/rrhh/lib/connectors/bamboohr.ts`, talking directly to the shared
   `/api/bamboohr` proxy. Some mapping logic is intentionally duplicated from Nómina's
   connector — that's the correct trade-off for module isolation.

2. **Richer employee model than Nómina.** Nómina's `Employee` type is payroll-focused.
   RRHH needs HR fields (personal info, contact, supervisor, division, location). I
   defined a separate `RrhhEmployee` type in `src/modules/rrhh/types/` fetched via the
   BambooHR **custom report** endpoint (the only one exposing `payRate`, `hireDate`,
   `supervisorEId`, `employmentHistoryStatus`, etc. in one call).

3. **Offline-first via module store + localStorage**, mirroring the existing Nómina
   `employeesStore` pattern (Zustand + `storage` abstraction + manual "Sync" button +
   `lastSync`). I did **not** introduce a divergent TanStack-Query data flow for the
   directory, to stay consistent with the established codebase pattern. Hooks expose
   `{ data, loading, error, sync }`. Module-local store lives under
   `src/modules/rrhh/store/` (only imported within rrhh, so module isolation holds).

4. **Reads BambooHR config from the shared `settingsStore`** (`bamboohr.subdomain` /
   `bamboohr.apiKey`), the same source Nómina uses — so once the user connects BambooHR
   in Nómina → Connectors, RRHH works with zero extra setup. No API keys in frontend
   code or localStorage beyond what the existing app already stores.

5. **Own sidebar/layout.** The shared `Sidebar`/`Layout` are hardcoded to Nómina's nav.
   RRHH gets its own `RrhhLayout` + `RrhhSidebar` inside the module, reusing the shared
   `Header`, `ThemeToggle`, `UserMenu`, design tokens, dark mode, and ES/EN toggle so it
   is visually indistinguishable from Nómina.

6. **`suiteModules` RRHH `active` flag** flipped to `true` and the route in `App.tsx`
   switched from the `<ModuleShell>` "Coming Soon" placeholder to the real module,
   gated by `<ProtectedRoute module="rrhh">`.

7. **No mutation UI.** Every RRHH screen is read-only display of BambooHR data, matching
   the brief. No add/edit/delete of employees.

---

## 2. Feature Status

| Feature | Status | Notes |
|---|---|---|
| Data layer (types, connector, store, hooks) | ✅ | typechecks; read-only connector |
| Module shell (layout, sidebar, routes, i18n) | ⬜ | |
| Employee directory | ⬜ | priority 1 |
| Employee profile | ⬜ | priority 2 |
| Org chart | ⬜ | priority 3 |
| Time-off view | ⬜ | priority 4 |
| Departments view | ⬜ | priority 5 |

---

## 3. Files Created / Changed

**Data layer (done):**
- `src/modules/rrhh/types/index.ts` — `RrhhEmployee`, `RrhhDepartment`, `OrgNode`,
  `RrhhTimeOffRequest`, `RrhhTimeOffBalance`.
- `src/modules/rrhh/lib/connectors/bamboohr.ts` — read-only `fetchRrhhDirectory()` +
  `fetchRrhhTimeOff()` via `/api/bamboohr` proxy.
- `src/modules/rrhh/lib/derive.ts` — `buildDepartments()`, `buildOrgChart()`,
  `countReports()`, `buildTimeOffBalances()` (pure, cycle-guarded).
- `src/modules/rrhh/store/rrhhStore.ts` — Zustand + `storage` (offline-first cache).
- `src/modules/rrhh/hooks/useRrhhDirectory.ts`, `useRrhhTimeOff.ts` —
  `{ data, loading/syncing, error, connected, sync }`.

---

## 4. Blockers & Workarounds

_(none yet)_

---

## 5. Next-Session Task List (prioritized)

_(to be refined as work proceeds)_

---

## 6. BambooHR Read-Only Audit

Every BambooHR network touch in this module, with method + endpoint:

_(table updated as connector code lands)_
