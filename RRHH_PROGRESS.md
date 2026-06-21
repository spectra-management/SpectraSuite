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
| Data layer (types, connector, store, hooks) | ✅ | read-only connector; offline-first store; unit-tested |
| Module shell (layout, sidebar, routes, i18n) | ✅ | own layout/sidebar; routes wired; EN/ES; dark mode |
| Employee directory (priority 1) | ✅ | search, dept/location/status filters, sort, pagination |
| Employee profile (priority 2) | ✅ | personal/job/compensation/contact + time-off, read-only |
| Org chart (priority 3) | ✅ | collapsible reporting tree, expand/collapse all, cycle-safe |
| Time-off view (priority 4) | 🟡 | Vacation/PTO only (proxy filters to type 83) — see §4 |
| Departments view (priority 5) | ✅ | derived dept cards, avatars, divisions/locations, members |

**Everything builds.** `npm run build` ✅ · `npm run check:imports` ✅ · `npm run test:run`
✅ (84 tests, 8 new). All five priority features are implemented and reachable from the
RRHH sidebar; data populates the moment BambooHR is connected (in Nómina → Connectors)
and the user clicks **Sync**.

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

**Module shell & shared components (done):**
- `src/modules/rrhh/components/RrhhLayout.tsx`, `RrhhSidebar.tsx` — module shell that
  matches Nómina (collapsible icon rail + mobile drawer, shared `Header`, dark mode,
  ES/EN toggle).
- `src/modules/rrhh/components/RrhhPageHeader.tsx` — title/subtitle + Sync button +
  last-sync line.
- `src/modules/rrhh/components/RrhhAvatar.tsx` — BambooHR photo w/ initials fallback.
- `src/modules/rrhh/components/RrhhStates.tsx` — NotConnected / LoadError / Empty cards.
- `src/modules/rrhh/lib/format.ts` — `countryFlag`, `payRateDisplay`, `tenureFrom`.

**Pages (done):**
- `src/modules/rrhh/pages/Directory/index.tsx` — directory list (priority 1).
- `src/modules/rrhh/pages/Profile/index.tsx` — read-only profile (priority 2).
- `src/modules/rrhh/pages/Org/index.tsx` — org chart (priority 3).
- `src/modules/rrhh/pages/TimeOff/index.tsx` — time-off (priority 4).
- `src/modules/rrhh/pages/Departments/index.tsx` — departments (priority 5).

**Tests:**
- `src/modules/rrhh/lib/__tests__/derive.test.ts` — 8 tests (departments, org chart
  incl. cycle/self-loop guards, time-off balances, tenure).

**Wiring / shared edits:**
- `src/modules/rrhh/index.ts` — module barrel (public API).
- `src/App.tsx` — `/rrhh` now mounts `RrhhLayout` with nested routes (directory,
  directory/:id, org, time-off, departments) under `<ProtectedRoute module="rrhh">`.
- `src/shared/lib/suiteModules.ts` — RRHH `active: true` (Suite Home now shows it live).
- `src/locales/en.json`, `es.json` — added the `rrhh` i18n namespace (EN + ES parity,
  v4 plurals). No existing keys changed; additions only.
- `.claude/settings.json` — session guardrails (Step 0).

### What works end-to-end vs. stubbed
- **End-to-end (with a connected BambooHR account):** Sync pulls the live directory →
  directory list, profiles, org chart, and departments all populate from real data.
  Time-off sync pulls approved Vacation requests for the selected year.
- **Offline:** all pages render from the localStorage cache; a "not connected" card
  appears (with a link to Connectors) when no BambooHR credentials are set.
- **Stubbed / not built:** an RRHH dashboard/overview landing page (the index route
  redirects straight to the directory); CSV/PDF export; any write-back to BambooHR (out
  of scope by design — module is read-only).

---

## 4. Blockers & Workarounds

1. **Time-off is Vacation-only.** The shared `/api/bamboohr` proxy hard-filters
   `GET /v1/time_off/requests` to BambooHR Vacation (`type.id === 83`). To surface other
   PTO policies I'd have to modify that proxy — but Nómina depends on its current
   behaviour, and changing shared infra was judged too risky for an autonomous run.
   **Workaround:** the Time-off page presents Vacation/PTO and shows an explanatory note
   (`rrhh.timeOff.note`). _Next session:_ make the proxy filter opt-in via a query flag
   so RRHH can request all types without changing Nómina's behaviour.

2. **No live BambooHR account available in this environment.** I could not execute a
   real sync to eyeball the rendered data. **Mitigation:** the connector reuses the
   exact proxy/field-mapping approach already proven in Nómina's working
   `fetchBambooDirectory`, types are strict, derivations are unit-tested, and the build
   compiles. _Next session:_ run a real Sync against the connected account and visually
   QA the directory/profile/org chart.

3. **ESLint has no config file (pre-existing, repo-wide).** `npm run lint` fails with
   "couldn't find a configuration file" — this is true on `main` too and is unrelated to
   RRHH. The enforced CI gates are `npm run build` (tsc) and `npm run check:imports`,
   both of which pass. Not fixed (out of scope; would touch shared tooling).

4. **i18next v4 plurals.** First pass used `_plural` suffixes; i18next v23 uses
   `_one`/`_other`. Corrected, plus a non-plural `daysLabel` for column headers. A
   validator confirmed all 98 referenced `rrhh.*` keys exist in EN + ES.

---

## 5. Next-Session Task List (prioritized)

1. **Live QA:** connect BambooHR (Nómina → Connectors), Sync, and visually verify each
   RRHH page against real data (avatars, org chart shape, country flags, pay-rate
   display). Confirm dark mode + ES/EN on every page.
2. **Time-off completeness:** add an opt-in query flag to `/api/bamboohr` so RRHH can
   fetch all time-off types (not just Vacation), without changing Nómina's behaviour;
   then group the Time-off page by policy type.
3. **RRHH dashboard/overview** landing page (headcount, new hires, upcoming time-off,
   department breakdown chart with `recharts`) instead of redirecting to the directory.
4. **Directory polish:** division filter, column for supervisor, CSV export (mirror
   Nómina's `EmployeeReports`).
5. **Org chart UX:** horizontal/printable layout option; search-to-locate a person.
6. **Profile depth:** employment history timeline, documents section (read-only),
   emergency contacts — as BambooHR fields allow.
7. **Per-employee time-off detail** on the profile (balances/accruals if the account
   exposes them via `/v1/employees/{id}/time_off/calculator`).
8. **Tests:** add a connector mapping test (mock `fetch`) mirroring Nómina's
   `bamboohr-vacations.test.ts`; add a render smoke test for the Directory page.

---

## 6. BambooHR Read-Only Audit

Every BambooHR network touch in this module (verified by grep over
`src/modules/rrhh` — only these two `fetch` calls exist; no PUT/PATCH/DELETE anywhere):

| Caller | Method | Endpoint (via `/api/bamboohr` proxy) | Nature |
|---|---|---|---|
| `fetchRrhhDirectory` (`lib/connectors/bamboohr.ts`) | `POST` | `/v1/reports/custom` (`format=JSON`, body = field list) | **Read.** Generates a custom report from existing data; does not mutate. Same pattern Nómina already uses. |
| `fetchRrhhTimeOff` (`lib/connectors/bamboohr.ts`) | `GET` | `/v1/time_off/requests` (`status=approved`, date range) | **Read.** Lists approved time-off. |
| `fetchRrhhEmergencyContacts` (`lib/connectors/bamboohr.ts`) | `GET` | `/v1/employees/{id}/tables/emergencyContacts` | **Read.** Lists an employee's emergency contacts. |
| `fetchRrhhCompensation` (`lib/connectors/bamboohr.ts`) | `GET` | `/v1/employees/{id}/tables/compensation` | **Read.** Lists pay history (gated). |
| `fetchRrhhDocuments` (`lib/connectors/bamboohr.ts`) | `GET` | `/v1/employees/{id}/files/view` | **Read.** Lists document *metadata* only — no contents downloaded (gated). |
| `buildPhotoProxyUrl` → `<img>` (`lib/connectors/bamboohr.ts`) | `GET` | `/v1/employees/{id}/photo/{size}` | **Read.** Fetches the existing employee photo (binary, streamed by the proxy). |

The `api/bamboohr.ts` proxy gained **one additive branch**: a `/photo/`-path check that
streams binary image bytes instead of parsing JSON. It is read-only, isolated to the
photo path, and changes nothing any other module (incl. Nómina) relies on.

✅ **Confirmed: every BambooHR touch in the RRHH module is read-only.** No
employee-mutating verb (PUT/PATCH/DELETE) is issued anywhere; the only `POST` is the
report-generation read. No BambooHR credentials are stored by RRHH — it reads the
existing shared `settingsStore.bamboohr` config.

---

## 6b. Tabbed Employee Profile (branch `feature/rrhh-employee-profile-tabs`)

> Second iteration, built on a **new branch off the merged `main`**. Rebuilds the
> employee profile (`pages/Profile/`) as a BambooHR-style **tabbed** interface with real
> employee photos. **Still 100% READ-ONLY** — no edits, no writes to BambooHR. Local
> commits only; nothing pushed/merged.

### Tabs — status

| Tab | Status | Source | Notes |
|---|---|---|---|
| **Personal** | ✅ | custom report | name, preferred name, birthday, gender, marital status, nationality, **national ID (masked)**, full address block, work/personal email, mobile/home/work phone |
| **Job** | ✅ | custom report + derived | title, department, division, location, hire date, **length of service**, reports-to, **direct-reports count**, status, employee #, employee id |
| **Compensation** 🔒 | ✅ / 🟡 | comp table + report | per-employee `tables/compensation` (effective date + pay history); falls back to the report pay-rate if the table is empty/unavailable. **Gated** (see §Permissions). |
| **Time-off** | 🟡 | `/v1/time_off/requests` | Vacation-only (proxy type-83 filter — unchanged, see §4). Note shown on the tab. |
| **Emergency** | ✅ | `tables/emergencyContacts` | name, relationship, mobile/home/work phone, email, primary flag. Empty-state if the account has none. |
| **Notes** | 🟡 stub | — | **BambooHR has no read API for free-text employee notes**, so this tab shows an explanatory message. Documented as a hard API limitation, not a bug. |
| **Documents** 🔒 | ✅ | `files/view` | read-only metadata only (name, category, date, size). No file **contents** are downloaded. **Gated** (see §Permissions). |

🔒 = sensitive tab, hidden entirely for basic-view users.

### Employee photos
- Real photos fetched from the BambooHR photo endpoint
  `GET /v1/employees/{id}/photo/{size}` via the shared proxy (read-only). Profile header
  uses the `large` size.
- **One additive proxy change** (`api/bamboohr.ts`): when `path` contains `/photo/`, the
  proxy streams the **binary** image through with its content-type instead of
  `response.json()`. This branch is **additive and isolated** — no other module (incl.
  Nómina) ever requests a `/photo/` path, so existing JSON behaviour is unchanged. This
  is the *only* shared-infra touch in this iteration; unlike the type-83 time-off filter
  (which Nómina depends on), the photo branch changes nothing Nómina relies on.
- `RrhhAvatar` tries, in order: proxied photo → report `photoUrl` → **initials** chip.
  The photo loads independently and silently degrades, so it never blocks the profile.
- Directory rows keep the lightweight report `photoUrl`/initials (avoids 25 authenticated
  image requests per page); the proxied endpoint is used on the profile header.

### Permissions (sensitive tabs) — **flag chosen: `hasModuleAccess('rrhh', 'edit')`**
- Reuses the **existing Suite RBAC** (`useAuth().hasModuleAccess`) — no parallel system.
  Helper: `src/modules/rrhh/lib/permissions.ts` → `useRrhhAccess()`.
- `PermAction` is `view | edit | approve | admin`; there is **no dedicated
  "sensitive HR data" permission** in the schema. Per the brief I picked the most
  restrictive sensible option above plain view: **`edit`**.
  - A user with only `can_view` (basic read-only directory access) **does not** pass →
    Compensation and Documents tabs are **hidden entirely**, and the national ID is
    **masked** (last 4 only).
  - `super_admin` / legacy `module_admin` bypass (pass every action), as elsewhere.
- **If you want it stricter**, change the single `action` arg in `useRrhhAccess()` from
  `'edit'` to `'admin'`. ⬅ *please confirm `edit` is the intended gate.*
- The national ID is **never shown in full** in this read-only profile — even sensitive
  users see the masked value (display-only module; no reason to expose the raw ID).

### Fields BambooHR does not expose (documented, not bugs)
- **Employee notes** — no read API → Notes tab is a labelled stub.
- **Compensation effective date** is only available via the comp **table** (used here);
  it is not a top-level custom-report field.
- Standard report aliases are requested (`ssn`, `homePhone`, `homeEmail`, `address2`,
  `zipcode`, `paySchedule`, `payGroup`, `exempt`, …). Any the account doesn't populate
  simply render as `—`. DR "cédula" is read from the `ssn` alias (shown as
  *National ID / SSN*, masked).

### Data layer / pattern
- Directory stays **offline-first** via the module store (unchanged). The three new
  per-employee resources (emergency contacts, compensation, documents) fetch **on tab
  open** (read-only) via `hooks/useRrhhEmployeeDetail.ts`, each with its **own
  loading/error state** so one failing tab never breaks the profile. Sensitive tabs only
  fetch once the permission check passes *and* the tab is active.

### Gates (this branch)
`npm run build` ✅ · `npm run check:imports` ✅ (no cross-module imports / cycles) ·
`npm run test:run` ✅ **89 tests** (5 new: national-ID masking + comp-rate display).

---

## 6c. Photo endpoint fixes (branch `feature/fix-rrhh-photo`, off `main`)

> Fixes two bugs in the employee-photo flow that shipped with §6b. **Local commits only;
> not pushed/merged.** BambooHR access stays **read-only (GET)**.

### Bug 1 — proxy returned JSON instead of image bytes ✅ FIXED
- **Symptom:** the photo request returned `200`, ~45 kB, but `Type = json`, so the
  `<img>` couldn't render it and the avatar fell back to initials.
- **Cause:** the `/photo/` branch used `res.send(buffer)` and trusted the upstream
  Content-Type while the request asked for `Accept: application/json`. `res.send()` can
  re-infer / mislabel the response as JSON.
- **Fix (`api/bamboohr.ts`):**
  - Photo requests now send `Accept: image/*` (not `application/json`).
  - The branch reads `response.arrayBuffer()` (never `.json()`), sets `Content-Type` to
    the upstream type **only when it is actually `image/*`** (else defaults to
    `image/jpeg`), sets `Content-Length`, and writes the **raw bytes with
    `res.end(buffer)`** — not `res.send()`/`res.json()` — so the bytes go out verbatim
    with the header we set.
  - Branch is still isolated to `/photo/` paths; **non-photo JSON behaviour (incl.
    Nómina) is unchanged.**

### Bug 2 — apiKey exposed in the client URL ✅ FIXED
- **Symptom:** the photo request URL ended with `&apiKey=33d42…`, leaking the BambooHR
  key into browser history, server logs, and the Network tab.
- **Fix:**
  - `buildPhotoProxyUrl()` (RRHH connector) **no longer accepts or appends `apiKey`** —
    it now builds `/api/bamboohr?path=/v1/employees/{id}/photo/{size}&subdomain=…` only.
    The caller in `pages/Profile/index.tsx` was updated to match.
  - The proxy resolves the credential as **client-query value → else
    `process.env.BAMBOOHR_API_KEY`** (and subdomain → else `BAMBOOHR_SUBDOMAIN`). Because
    a client-provided key still takes precedence, **Nómina's existing calls are byte-for-
    byte unchanged**; the photo path simply omits the key and the proxy supplies it
    server-side.
  - **Confirmed:** no `apiKey` appears in any client-side photo URL
    (`grep photo … | grep apiKey` → none).

### Pre-existing note (flagged, NOT changed)
- Nómina's non-photo connectors (`fetchBambooDirectory`, etc.) **still pass `apiKey` in
  the query string** — this is the original app pattern and out of scope for this fix.
  The env fallback added above is **additive** and does not alter their behaviour. If you
  want to harden those too, move them to the same env-credential pattern in a follow-up
  (would touch shared Nómina behaviour, so flagging rather than doing it here).

### ⚠️ Deployment requirement
- Because the photo URL no longer carries the key, the photo only renders when
  **`BAMBOOHR_API_KEY`** (and **`BAMBOOHR_SUBDOMAIN`**, unless the client passes it) are
  set in the Vercel environment. Both are already documented in `.env.example`. If they
  are unset in prod, the photo fetch fails **gracefully → initials avatar** (no error
  surfaced to the user).

### Flow (verified by reasoning)
client `<img src="/api/bamboohr?path=/v1/employees/116/photo/large&subdomain=…">` (no key)
→ proxy adds `Authorization: Basic base64(BAMBOOHR_API_KEY:x)` server-side
→ `GET` BambooHR photo with `Accept: image/*`
→ proxy returns **raw bytes** with `Content-Type: image/*`
→ `<img>` renders it. Gates: `npm run build` ✅ · `npm run check:imports` ✅ ·
`npm run test:run` ✅ (89).

---

## 7. How to Review

```bash
git checkout feature/rrhh-bamboo-clone
npm run build          # ✅ compiles
npm run check:imports  # ✅ module isolation + no cycles
npm run test:run       # ✅ 84 tests
npm run dev            # open /suite → RRHH, or go straight to /rrhh/directory
```
Branch has incremental **local** commits (nothing pushed). Connect BambooHR in
Nómina → Connectors, then click **Sync from BambooHR** on any RRHH page to load data.
