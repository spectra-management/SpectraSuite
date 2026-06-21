# Architecture — Spectra Suite

This document describes how Spectra Suite is structured: the modular front-end,
the data model, the security model, and the key cross-cutting flows. For local
setup see [DEVELOPMENT.md](./DEVELOPMENT.md); for production see
[DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 1. High-level overview

Spectra Suite is a single-page React application (Vite) backed by Supabase
(PostgreSQL + Auth + RLS) and a thin layer of Vercel serverless functions used as
CORS-safe proxies and for privileged operations.

```
┌──────────────────────────────────────────────────────────────┐
│                        Browser (SPA)                          │
│   React 18 · Router · Zustand · TanStack Query · i18n         │
│                                                               │
│   suite/  ──launches──▶  modules/nomina  ·  rrhh … (soon)     │
│        │                        │                             │
│        └────── shared/ (auth, ui, lib, stores, types) ───────┘│
└───────────┬───────────────────────────────┬──────────────────┘
            │ supabase-js (RLS)              │ fetch /api/*
            ▼                                ▼
┌────────────────────────┐      ┌─────────────────────────────┐
│   Supabase             │      │  Vercel Serverless (/api)   │
│   • Postgres + RLS     │      │  • bamboohr  (proxy)        │
│   • Auth (Google OAuth)│      │  • hubstaff  (proxy+OAuth)  │
│   • SECURITY DEFINER   │      │  • email     (Resend)       │
│     RPCs (audit, admin)│      │  • invite    (service-role) │
└────────────────────────┘      └──────────┬──────────────────┘
                                            │
                       ┌────────────────────┼───────────────────┐
                       ▼                    ▼                   ▼
                   BambooHR             Hubstaff         Google APIs
                  (employees)        (hours tracked)  (Calendar/Tasks/Gmail)
```

**Why serverless proxies?** BambooHR and Hubstaff don't allow browser CORS and
require secrets; the `/api/*` functions keep credentials off the client and add
OAuth token exchange (Hubstaff) and email delivery (Resend).

---

## 2. Front-end modular architecture

The codebase is split into three layers with a strict, CI-enforced dependency
direction. See [src/IMPORT_RULES.md](./src/IMPORT_RULES.md) for the canonical rules.

```
            ┌─────────────┐   ┌─────────────┐
            │  modules/*  │   │   suite/    │     features
            └──────┬──────┘   └──────┬──────┘
                   │                 │
                   └────────┬────────┘
                            ▼
                     ┌─────────────┐
                     │   shared/   │              foundation
                     └─────────────┘
```

### Layers

- **`src/modules/<feature>/`** — Isolated features. Each owns its `pages/`,
  `lib/`, and (optionally) `components/`, `hooks/`, `context/`, `types/`, exposed
  through an `index.ts` barrel. `nomina` is fully built; `rrhh`, `facturacion`,
  `gastos`, `it` are placeholders that render the shared `ModuleShell` "Coming
  Soon" surface.
- **`src/shared/`** — The foundation every module may use: `components/` (UI
  primitives + layout + `ProtectedRoute` + `ErrorBoundary`), `context/`
  (`AuthContext`, `ThemeContext`), `hooks/`, `lib/` (supabase client, audit,
  google, payroll-defaults, utils), `store/` (Zustand), `types/`.
- **`src/suite/`** — The Suite shell: the home launcher/dashboard and super-admin
  settings.
- **`src/App.tsx` / `src/main.tsx`** — Composition root. Wires the router,
  `AuthProvider`, and the root `ErrorBoundary`.

### Enforced boundaries (CI: `npm run check:imports`)

1. A module **must not** import from another module — features talk only through
   `shared`.
2. `shared/**` **must not** import from a feature (`modules/**` or `suite/**`).
3. `shared/lib/**` (the foundation) **must not** import feature state
   (`shared/store/**`).
4. No circular dependencies (`madge --circular`).

`App.tsx` / `main.tsx` are the only files exempt — by design they compose all
layers. When a module would otherwise need something from `shared` that depends on
it, the dependency is **inverted**: e.g. `shared/lib/payroll-defaults.ts` holds the
DR fiscal defaults and `modules/nomina/lib/payroll/constants.ts` re-exports them.

### Path alias

`@/` → `src/`. Always import via `@/shared/...`, `@/modules/nomina/...` rather than
deep relative chains.

---

## 3. State management

| Concern | Tool | Notes |
|---------|------|-------|
| Server data / caching | **TanStack Query** | Async fetches (e.g. audit log, integrations) with `retry: 1` |
| App/client state | **Zustand** (`shared/store`) | settings, payroll runs, employees, payment methods, bank accounts, vacation payments |
| Auth/session | **React Context** (`AuthContext`) | session, profile, roles, permissions, session-timeout |
| Theme / i18n | Context + `react-i18next` | persisted in `localStorage` (`spectra_*`) |

Persistence today is `localStorage` via a typed `storage.ts` abstraction (keys
prefixed `spectra_`), with Supabase as the cloud source of truth for company
settings, roles, audit, and payroll runs. The abstraction is intentionally
Supabase-shaped to ease full migration.

---

## 4. Data model (Supabase)

Created and evolved by idempotent migrations `001`–`007` in
`supabase/migrations/`.

| Table | Purpose |
|-------|---------|
| `profiles` | One row per auth user; `role` (super_admin / module_admin / member), `is_active` |
| `roles` | RBAC roles (6 system roles seeded + custom) |
| `role_permissions` | Per-role, per-module flags: `can_view/edit/approve/admin` |
| `user_roles` | Many-to-many: users ↔ roles |
| `user_module_permissions` | Legacy direct per-user grants (still aggregated) |
| `company_settings` | Company branding, RNC, `session_timeout_minutes` (public-readable for login branding) |
| `integrations` | Connector configuration metadata |
| `payroll_runs` | Approved payroll periods + totals |
| `vacation_payments` | Vacation pay records |
| `audit_log` | Append-only, tamper-proof audit trail (client read-only) |

### Key database functions (SECURITY DEFINER)

- `is_super_admin()` — used by RLS policies (migration 003; consumed by 005/006/007).
- `claim_super_admin_if_first()` — promotes the very first user to super_admin,
  no-ops otherwise (safe to call on every non-admin login).
- `log_audit_event(...)` — the **only** way to write `audit_log`. Stamps
  `auth.uid()` server-side; the table is read-only to clients via RLS, so users
  cannot forge, edit, or delete their own audit records.

---

## 5. Security model

### Authentication
- **Google OAuth only** (no passwords). Scopes: `openid email profile`, plus
  Calendar (readonly), Tasks, Gmail (readonly) for the dashboard.
- **Corporate-domain gate:** `AuthContext.applySession()` rejects any account whose
  email does not end in `@spectramanagement.net` — signs out, clears tokens, and
  bounces to `/login` with a translated reason. Enforced on every session load
  (fresh sign-in *and* reload), not just at the click.
- `provider_token` (+ refresh token) is cached in `localStorage` on `SIGNED_IN`
  (Supabase only returns it on the initial event) for the Google widgets.

### Authorization (RBAC)
- 6 seeded system roles: Super Admin, Payroll Manager, HR Manager, Finance
  Director, Payroll Viewer, HR Viewer — plus custom roles.
- Permissions are **per module × per action** (`view` ⊂ `edit` ⊂ `approve`, plus
  `admin`). A user's effective permission is the **OR** of all their roles.
- `ProtectedRoute` guards routes by `module` + `action` (and `requireSuperAdmin`).
  `hasModuleAccess(module, action)` is the single check used by routes and the
  sidebar (locked items are greyed out). super_admin / legacy module_admin bypass.

### Defense in depth
- **RLS** on every table; privileged writes go through SECURITY DEFINER RPCs.
- **Tamper-proof audit log** — append-only via RPC; read-only to clients.
- **Session timeout** — inactivity tracked client-side; warning at 95% of the
  configurable timeout (5–1440 min, default 480), auto-logout + audit at 100%.
- **No secrets in the bundle** — Supabase service role and connector keys live in
  serverless env / per-tenant settings, never in client code.

---

## 6. Cross-cutting flows

### Login → Suite
1. User clicks "Sign in with Google" → Supabase OAuth → redirect back.
2. `onAuthStateChange('SIGNED_IN')` → domain gate → load profile, roles,
   permissions, company settings, session-timeout → audit `login`.
3. Redirect to `/suite`. The shell renders the module launcher + dashboard
   widgets (Calendar / Tasks / Gmail / module summaries).

### Payroll run (Nómina)
1. **Step 1 – Period:** choose country (from active employees) + frequency
   (weekly / biweekly / full month) + dates.
2. **Step 2 – Hours:** review/edit hours; holiday & night premiums; currency per
   employee country.
3. **Step 3 – Calculate:** `getPayrollRules(country, …)` selects the engine —
   **DR** (DGII ISR + AFP/SFS), **US** (federal + SS/Medicare), **MX/JM/PH/KE**
   (placeholders, 0% until real tables added), else generic. `calculatePayroll`
   produces gross/deductions/net with half-up rounding.
4. **Step 4 – Approve & Send:** PDF preview/download, email via `/api/email`,
   audit `payroll_approved` (and `paystub_sent` per send).

### Audit logging
Any sensitive action calls `logAuditEvent(...)` → `log_audit_event` RPC. The Suite
Settings → Audit Log tab reads it back with **server-side pagination**
(`useAuditLog` + Supabase `.range()`, 25/page) and filters.

---

## 7. Internationalization & design system

- **i18n:** `react-i18next`, English (default) + Spanish, zero hardcoded strings
  in components (`src/locales/{en,es}.json`). Paystub language follows the
  employee's country, independent of UI language.
- **Design system:** white base, emerald primary (`emerald-600`), Inter font,
  `rounded-xl` cards / `rounded-lg` controls, soft shadows, lucide icons only.

---

## 8. Domain rules (Dominican Republic payroll)

These are encoded in the payroll engine and configurable via Fiscal Parameters:

- **TSS (before ISR):** AFP 2.87% (cap 20× min cotizable), SFS 3.04% (cap 10×).
- **ISR:** DGII annual scale, applied on salary after TSS.
- **Daily divisor:** 23.83 (never ×12/365).
- **Rounding:** 2 decimals, half-up (`roundHalfUp`), formatted `RD$ 1,234.56`.
- **Overtime / holiday:** configurable thresholds and multipliers.
