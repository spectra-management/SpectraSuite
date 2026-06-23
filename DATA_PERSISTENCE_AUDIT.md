# DATA_PERSISTENCE_AUDIT.md

**Scope:** Investigation only — no code changed. Maps where every piece of app data
lives, explains why Hubstaff/BambooHR connection data and history disappear after
deployments, and specifies (without implementing) a safe "factory reset" to zero.

**Date:** 2026-06-23 · Branch inspected: `feature/billing-module`

---

## Executive summary

The app is **localStorage-first**. A thin, *best-effort* cloud-sync layer
(`src/shared/lib/cloudSync.ts`) mirrors a few things to Supabase, but the mirror is
**asymmetric**: some data is written to the cloud AND read back on boot (so it
survives), while connector credentials are **written to the cloud but never read back**
(so they do not survive). Combined with two wipe vectors, this produces the reported
symptom.

Three independent mechanisms cause "data disappears":

1. **localStorage is origin-scoped.** A deploy to a *different origin* (preview URL vs
   production domain, or a domain change) starts with an empty `localStorage`. Most app
   data lives only there, so it looks "wiped after a deploy." (A redeploy to the **same**
   origin does **not** clear `localStorage`.)
2. **Connector credentials are mirrored to Supabase write-only.** `saveBambooIntegration`
   / `saveHubstaffIntegration` write to the `integrations` table, but the reader
   `fetchIntegration` is **never called anywhere** — so on a fresh origin (or after a
   wipe) the connectors revert to disconnected defaults even though the credentials are
   sitting in Supabase. By contrast, **company settings ARE read back** on boot
   (`hydrateCompanyFromCloud`), which is why they survive and connectors don't.
3. **The inactivity session-timeout calls native `localStorage.clear()`**
   (`AuthContext.tsx:269`) — a full wipe of everything, fired when the idle timer hits
   100%. Normal logout does **not** do this; only the timeout does.

There is **no app-wide "schema version" wipe** and **no clear-on-deploy/version code**.
The only migration-on-load is a harmless in-place rename of one Hubstaff field
(`settingsStore.ts:80-88`), which never clears anything.

> **Recoverability note:** the Hubstaff refresh token and BambooHR credentials are
> durably stored in the Supabase `integrations` table (the Hubstaff proxy even re-writes
> the rotated token server-side, `api/hubstaff.ts:66-99`). They are not *gone* — the app
> simply never restores them to the client. An operator can read them back from the
> `integrations` table.

---

## 1. STORAGE MAP

Source of truth (SoT) legend: **LS** = localStorage, **Cloud** = Supabase.
"Mirrored reliably?" describes whether the data is dependably present in the *other*
store so it survives an origin change / local wipe.

### 1a. Connectors, settings, company

| Data item | localStorage key(s) (`spectra_` prefix) | Supabase table | Source of truth | Mirrored reliably? |
|---|---|---|---|---|
| **BambooHR connection** (subdomain, apiKey, `connected`) | `bamboohr_config` | `integrations` (name=`bamboohr`) | **LS** | **NO — write-only.** Written by `saveBambooIntegration` (`settingsStore.ts:138`); **never read back** (`fetchIntegration` has zero callers). Lost on origin change/wipe. |
| **Hubstaff connection** (refreshToken, organizationId, `connected`, employeeMapping, cached access token) | `hubstaff_config` | `integrations` (name=`hubstaff`) | **LS** | **NO — write-only to client store.** Written by `saveHubstaffIntegration` (`settingsStore.ts:145`) and server-side on rotation (`api/hubstaff.ts:66-99`); **never read back** into the client. Lost from the UI on origin change/wipe. |
| **Email/Resend config** (provider, fromName, fromEmail, secrets, `connected`) | `email_config` | *(none wired)* | **LS** | **NO — LS only.** `updateEmailConfig` does not call any cloud writer; `integrations` supports a `resend` row but nothing writes it. |
| **Company settings** (name, RNC, address, phone, logo, colors) | `company_settings` | `company_settings` | Cloud (authoritative on hydrate) | **YES.** Write `saveCompanySettings` (`settingsStore.ts:98`) + **read-back** `hydrateCompanyFromCloud` on boot (`AuthContext.tsx:217`). **Survives deploys.** |
| **Session timeout minutes** | *(in company object)* | `company_settings.session_timeout_minutes` | Cloud | YES (read in `AuthContext` + Security panel). |
| **Payroll settings** (OT threshold, rates) | `payroll_settings` | — | LS | NO — LS only. |
| **Night-shift settings** | `payroll_night_settings` | — | LS | NO — LS only. |
| **Fiscal parameters** (ISR brackets, AFP/SFS, divisor) | `fiscal_parameters` | — | LS | NO — LS only. |
| **Email template** | `email_template` | — | LS | NO — LS only. |
| **Language / theme / sidebar state** | `language`, `theme`*, `sidebar_collapsed`* | — | LS | NO — LS only (UI prefs; *not `spectra_`-prefixed). |

### 1b. People, payroll, vacations

| Data item | localStorage key(s) | Supabase table | Source of truth | Mirrored reliably? |
|---|---|---|---|---|
| **Employees** (roster, deductions, `payroll_active`) | `employees` | *none* (migration 008 is a defensive no-op; no `employees` table) | **LS** | **NO — LS only.** Re-synced from BambooHR if the connector is reconnected. |
| **Payroll runs / history** | `payroll_history` | `payroll_runs` (exists, **unused**) | **LS** | **NO — LS only.** `payroll_runs` has **zero** frontend reads/writes. |
| **Employee payment methods** | `employee_payment_methods` | — | LS | NO — LS only. |
| **Employee bank accounts** | `employee_bank_accounts` | — | LS | NO — LS only. |
| **Holidays + last sync** | `payroll_holidays`, `holidays_last_sync` | — | LS | NO — LS only (re-syncable from Nager.Date). |
| **Vacation rules** | `vacation_rules` | — | LS | NO — LS only. |
| **Vacation payments made** | `vacation_payments_made` | `vacation_payments` (exists, **unused**) | **LS** | **NO — LS only.** `saveVacationPayment` exists but has **zero callers**. |
| **Pending vacation ISR** | `pending_vacation_isr` | — | LS | NO — LS only. |

### 1c. RRHH, billing, platform

| Data item | localStorage key(s) | Supabase table / bucket | Source of truth | Mirrored reliably? |
|---|---|---|---|---|
| **RRHH employees / time-off cache** | `rrhh_employees`, `rrhh_timeoff`, `rrhh_timeoff_year`, `rrhh_last_sync` | — | LS | NO — LS only (cache of BambooHR; re-syncable). |
| **RRHH photo overrides (map)** | `rrhh_photo_overrides` | `rrhh_employee_photos` table + `employee-photos` Storage bucket | **Cloud** | **YES — photos survive.** Bucket+table are SoT; LS holds only the override map + in-memory signed URLs (`rrhhPhotoStore`, `photoStorage.ts`). The table/bucket require **manual** dashboard setup. |
| **Billing clients** | `billing_clients` | `billing_clients` (migration 009, **not applied / unused**) | **LS** | **NO — LS only.** Store is localStorage (`billingStore.ts`); 009 is forward-looking. |
| **Billing title rates** | `billing_title_rates` | `billing_title_rates` (unused) | LS | NO — LS only. |
| **Billing client-employee assignments/overrides** | `billing_client_employees` | `billing_client_employees` (unused) | LS | NO — LS only. |
| **Billing invoices** | `billing_invoices` | `billing_invoices` (unused) | LS | NO — LS only. |
| **Billing meta (bonus labels)** | `billing_meta` | — | LS | NO — LS only. |
| **Audit log** | *(none)* | `audit_log` | **Cloud** | **YES — survives.** Written only via `log_audit_event` RPC (`audit.ts:26`); read via `useAuditLog`. Tamper-proof, server-side. |
| **User profiles** | *(none)* | `profiles` | **Cloud** | YES — survives. |
| **Roles / role permissions / user-role assignments** | *(none)* | `roles`, `role_permissions`, `user_roles` | **Cloud** | YES — survives. |
| **Legacy module permissions** | *(none)* | `user_module_permissions` | **Cloud** | YES — survives. |
| **Google OAuth tokens** | `google_provider_token`, `google_provider_refresh_token`* | — (Supabase session is separate) | LS | Transient; re-obtained on Google re-auth (*not `spectra_`-prefixed). |
| **Suite todos / Hubstaff profile cache / employee status filter** | `spectra_local_todos`, `spectra_hs_profiles` (24h TTL), `spectra_employees_status_filter` | — | LS | NO — local caches/UI only. |

**Net:** Only **company settings, RRHH photos, audit log, profiles/roles/permissions**
survive an origin change or local wipe. **Everything else — including both connectors,
employees, payroll history, vacations, billing, and all payroll settings — is
localStorage-only and is lost.**

---

## 2. WHY DATA IS LOST ON DEPLOY

Answering each sub-question with the exact mechanism and file references.

### 2.1 Is the data localStorage-only / origin-tied? — **Yes (primary cause)**
`localStorage` is partitioned by **origin** (scheme + host + port), per the browser, not
by the app. Per the storage map, the connectors and almost all operational data live
**only** in `localStorage` (`src/shared/lib/storage.ts`, `spectra_` prefix). Consequences:

- Configuring the app on a **Vercel preview URL** (e.g.
  `spectra-git-<branch>-<scope>.vercel.app`, unique per branch/deploy) and then visiting
  the **production domain** = a *different origin* = an empty `localStorage` = "everything
  is gone after deploy."
- A custom-domain change, or `*.vercel.app` vs the mapped domain, has the same effect.
- **A redeploy to the same origin does NOT clear `localStorage`** — the data is still
  there. So if loss happens on same-origin redeploys, the cause is §2.4 (timeout wipe),
  not the deploy itself.

### 2.2 Any clear/migrate-on-version-change wipe? — **No**
- No `schema_version` / `app_version` / "wipe old data on upgrade" logic exists anywhere
  (grep across `src/` returns nothing).
- The only load-time migration is an **in-place** Hubstaff field rename
  (`accessToken` → `refreshToken`) at `settingsStore.ts:80-88`. It rewrites a single key
  and **never clears** other data.
- `storage.clear()` (`storage.ts:32-36`, removes only `spectra_`-prefixed keys) is
  **defined but has no callers** in app flows.

### 2.3 Are credentials persisted to Supabase, or only a client store that resets? — **Persisted, but never restored (the core bug)**
This is the decisive finding:

- **Write path exists:** `updateBambooHR` → `saveBambooIntegration` (`settingsStore.ts:138`)
  and `updateHubstaff` → `saveHubstaffIntegration` (`settingsStore.ts:145`) upsert
  credentials into the `integrations` table (`cloudSync.ts:108-114`). The Hubstaff proxy
  also persists the **rotated** refresh token server-side
  (`api/hubstaff.ts:66-99`, `persistRotatedTokenToDb`).
- **Read-back path is missing:** `fetchIntegration` (`cloudSync.ts:117-134`) is the only
  function that would restore connector creds from Supabase — and it has **zero callers**
  anywhere in `src/`. The store initializes `bamboohr`/`hubstaff` from **localStorage
  only** (`settingsStore.ts:76-90`). On boot, `AuthContext.applySession` calls
  `hydrateCompanyFromCloud()` (`AuthContext.tsx:217`) but **no** equivalent for
  integrations.
- **Result:** the credentials are durably in Supabase, but on a fresh origin / after a
  wipe the client shows the connectors as disconnected (defaults: `connected:false`,
  empty token) and never repopulates them. This is exactly why **company settings survive
  a deploy but the connectors do not** — same cloud layer, but only company has a
  read-back call.
- **Proxy asymmetry (matters for "does data still flow?"):**
  - **BambooHR** proxy falls back to **server env** `BAMBOOHR_API_KEY` /
    `BAMBOOHR_SUBDOMAIN` (`api/bamboohr.ts:20-22`). If those env vars are set in the
    deployment, BambooHR fetches can still work even though the UI shows "disconnected."
  - **Hubstaff** proxy has **no env fallback** — it requires the client to send the token
    via the `x-hubstaff-refresh-token` header (`api/hubstaff.ts:159,169-173`). With an
    empty client store it returns 400 and Hubstaff fully stops until reconnected.

### 2.4 Does auth/logout/session flow clear localStorage? — **Yes, on inactivity timeout (full native wipe)**
- **Inactivity timeout** → `handleSessionExpired` runs `localStorage.clear()` —
  the **native** call that wipes **everything** for the origin (all `spectra_*` keys,
  theme, Google tokens), at `AuthContext.tsx:269`. It fires when the idle timer reaches
  100% of `sessionTimeoutMinutes` (default **480 min**, configurable 5–1440;
  `AuthContext.tsx:42,289-321`).
- **Normal logout** (`signOut`, `AuthContext.tsx:252-263`) removes **only** the two
  Google token keys — it does **not** clear app data.
- **Domain-rejection path** (non-corporate email, `AuthContext.tsx:182-198`) removes only
  Google tokens.
- **Net:** any user who leaves the app idle past the timeout will, on expiry, lose **all**
  local data — and because connectors aren't re-hydrated (§2.3), the connection is gone.
  This can be mistaken for "lost after a deploy."

### 2.5 Is data scoped to a domain that changes between preview and production? — **Yes**
See §2.1. This is the most likely trigger for the "after a deployment" framing: each
Vercel **preview** deployment has its own hostname, and the **production** domain is
different again. Data entered against one origin is invisible to another. The fix concept
(not implemented) is to make connectors cloud-hydrated like company settings, so origin no
longer matters.

### 2.6 Summary of the loss chain
```
Deploy to new origin (preview→prod)   ─┐
        OR idle past session timeout    ├─►  localStorage for connectors is empty
        OR new browser/device          ─┘
                                              │
   fetchIntegration() is never called ───────┤  (creds ARE in Supabase integrations,
                                              │   but nothing reads them back)
                                              ▼
                       UI shows BambooHR/Hubstaff "disconnected";
                       Hubstaff data flow stops (no env fallback);
                       payroll history / employees / billing also gone (LS-only)
```

---

## 3. RESET-TO-ZERO (specification only — NOT implemented)

Goal: a controlled "factory reset" before production. Below is exactly what a safe reset
must clear, what it must preserve, and the open questions to confirm with you **before**
anything is built or run. Nothing here is executed.

### 3.1 What must be CLEARED

**A. Supabase tables — operational/business data (truncate):**
- `payroll_runs` *(currently unused, but truncate for cleanliness)*
- `vacation_payments` *(currently unused; truncate)*
- `audit_log` *(see open question — you may want to KEEP this)*
- Billing tables **only if migration 009 has been applied**: `billing_invoices`,
  `billing_client_employees`, `billing_title_rates`, `billing_clients`
  (delete child→parent order, or `TRUNCATE ... CASCADE`).
- `integrations` **only if** you want to force re-entry of BambooHR/Hubstaff/Resend creds
  (see open question — likely **PRESERVE**).
- `rrhh_employee_photos` + the `employee-photos` Storage bucket objects **only if** you
  want to drop uploaded photos.

**B. localStorage — per browser/origin (clear `spectra_`-prefixed keys):**
The cleanest local reset is `storage.clear()` semantics (removes all `spectra_*` keys),
which covers: `company_settings`, `payroll_settings`, `payroll_night_settings`,
`fiscal_parameters`, `bamboohr_config`, `hubstaff_config`, `email_config`,
`email_template`, `employees`, `employee_payment_methods`, `employee_bank_accounts`,
`payroll_holidays`, `holidays_last_sync`, `vacation_rules`, `vacation_payments_made`,
`pending_vacation_isr`, `payroll_history`, `language`, `billing_*` (5 keys), plus the
module-local `rrhh_*` keys and caches (`spectra_local_todos`, `spectra_hs_profiles`,
`spectra_employees_status_filter`).
- **Caveat:** localStorage is per-origin and per-browser. Clearing it on one machine does
  **not** clear it on others. A reset must therefore be done on every device, OR the data
  must be made cloud-authoritative first. The native `localStorage.clear()` also drops
  `theme`, `sidebar_collapsed`, and Google tokens (cosmetic / re-auth only).

### 3.2 What must be PRESERVED (recommended defaults — confirm)
- **`profiles`** — keep all users, **especially the super-admin** (deleting profiles can
  lock you out; the first-user bootstrap only promotes when *no* super_admin exists).
- **`auth.users`** — never truncate (Supabase Auth identities).
- **`roles`, `role_permissions`, `user_roles`, `user_module_permissions`** — keep RBAC so
  people retain access.
- **`company_settings`** — keep branding/RNC/logo/session-timeout (it's cloud-authoritative
  and re-hydrates; wiping it just makes everyone reconfigure).
- **`integrations`** — recommend **KEEP** (so connectors keep working / are recoverable).
  Reset them only if you specifically want a credentials purge.

### 3.3 Open questions to confirm BEFORE building/running a reset
1. **Audit log:** wipe `audit_log` to "start clean," or **keep** it for compliance/history?
   (Default recommendation: keep.)
2. **Connector credentials:** keep `integrations` (BambooHR/Hubstaff/Resend) so production
   stays connected, or purge to force re-entry? (Default: keep.)
3. **Company settings & branding:** keep, or reset to defaults? (Default: keep.)
4. **RRHH photos:** keep the `employee-photos` bucket + `rrhh_employee_photos`, or clear?
5. **Billing:** has migration **009** been applied? If not, billing is localStorage-only
   and the Supabase billing tables don't need truncation — only the local keys.
6. **Scope:** is the reset meant to clear data for **all browsers/users** (then it must be
   Supabase-side + a forced local re-sync) or just **this admin's browser**?
7. **Users:** keep all `profiles`/`user_roles`, or reduce to just the super-admin for a
   clean production launch?

### 3.4 Important pre-reset corollary (so the reset "sticks")
Because connectors and most operational data are localStorage-only and **not** restored
from the cloud, "reset to zero" today largely means **"clear each browser's
localStorage."** That is fragile for a product going to production:

- Clearing localStorage on the admin's machine does not affect other users' machines.
- Re-entered connector creds will again silently fail to survive the next origin change /
  timeout wipe, because `fetchIntegration` is still never called (§2.3).

A durable reset (and a durable *fix* for the reported loss) requires deciding whether
connectors/employees/payroll/billing should become **cloud-authoritative** (write **and**
read-back through Supabase) before launch. That is a design decision for you — **no code
change is made here.**

---

## Appendix — Key evidence (file:line)

- localStorage abstraction + keys: `src/shared/lib/storage.ts` (`spectra_` prefix;
  `clear()` at `:32-36`, no callers).
- Connector store init from LS only: `src/shared/store/settingsStore.ts:76-90`.
- Connector cloud **write** calls: `settingsStore.ts:138` (Bamboo), `:145` (Hubstaff).
- Connector cloud **read-back** missing: `cloudSync.ts:117-134` `fetchIntegration` —
  **0 callers** in `src/`.
- Company settings read-back (why it survives): `settingsStore.ts:103-109` +
  `AuthContext.tsx:217`.
- Full native wipe on inactivity: `AuthContext.tsx:269` (`localStorage.clear()`), timer at
  `:289-321`, default timeout `:42`.
- Normal logout removes only Google tokens: `AuthContext.tsx:252-263`.
- Hubstaff proxy needs client-sent token, persists rotation server-side:
  `api/hubstaff.ts:159,169-173,66-99`.
- BambooHR proxy env fallback: `api/bamboohr.ts:20-22`.
- Unused Supabase tables (no frontend writers): `payroll_runs`, `vacation_payments`
  (`saveVacationPayment` has 0 callers), billing tables (migration 009 not applied).
- No schema-version/clear-on-deploy logic: grep across `src/` returns none.
