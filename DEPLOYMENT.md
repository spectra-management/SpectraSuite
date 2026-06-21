# Deployment — Spectra Suite

How to deploy Spectra Suite to production: **Vercel** (frontend + serverless API)
and **Supabase** (database, auth, RLS). For architecture see
[ARCHITECTURE.md](./ARCHITECTURE.md); for local work see
[DEVELOPMENT.md](./DEVELOPMENT.md).

---

## 1. Prerequisites

- A **Supabase** project (PostgreSQL + Auth).
- A **Vercel** project linked to this Git repository.
- A **Google Cloud** OAuth client (for Supabase Google provider + Calendar/Tasks/Gmail scopes).
- A **Resend** account (transactional email) — optional, can also be set in-app.
- Node.js **18+** locally (CI/Vercel use their default LTS).

---

## 2. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production +
Preview). Locally, copy `.env.example` → `.env.local`.

| Variable | Scope | Required | Purpose |
|----------|-------|:--------:|---------|
| `VITE_SUPABASE_URL` | Client + Server | ✅ | Supabase project URL (also read by `/api/invite`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Client | ✅ | Supabase publishable (anon) key — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | ✅ | Service-role key for `/api/invite` (admin user creation). **Never expose to the client.** |
| `BAMBOOHR_API_KEY` | Server | ⬜ | Optional fallback; normally configured in-app (Connectors) |
| `BAMBOOHR_SUBDOMAIN` | Server | ⬜ | Optional fallback (e.g. `spectrahm`) |
| `RESEND_API_KEY` | Server | ⬜ | Optional fallback; normally configured in-app |

> ⚠️ **Security:** Only `VITE_`-prefixed vars are bundled into the client. Keep
> `SUPABASE_SERVICE_ROLE_KEY` (and any connector secrets) server-side. Connector
> and email credentials are normally entered at runtime via **Settings →
> Connectors** and stored per-tenant, so the optional vars above are fallbacks only.

---

## 3. Supabase setup

### 3.1 Run migrations (in order)

Apply the SQL migrations from `supabase/migrations/` **in numeric order** via the
Supabase **SQL Editor** (or the Supabase CLI). They are idempotent and safe to
re-run.

| # | File | Adds |
|---|------|------|
| 001 | `001_initial_schema.sql` | profiles, company_settings, integrations, payroll_runs, base RLS |
| 002 | `002_first_user_admin.sql` | first-user → super_admin bootstrap |
| 003 | `003_fix_rls_recursion.sql` | `is_super_admin()` + non-recursive RLS (**required by 005/006/007**) |
| 004 | `004_public_company_settings.sql` | public read of branding for the login page |
| 005 | `005_audit_log_and_session_timeout.sql` | `audit_log` table + `session_timeout_minutes` |
| 006 | `006_rbac_roles.sql` | `roles`, `role_permissions`, `user_roles` + 6 system roles |
| 007 | `007_audit_rpc.sql` | `log_audit_event()` RPC + read-only audit RLS |

> Order matters: **003 must run before 005/006/007** (they depend on
> `is_super_admin()`). If you see `relation "audit_log" does not exist`, run 005
> before 007.

### 3.2 Configure Google Auth

1. In **Google Cloud Console**, create an OAuth 2.0 Client (Web). Add the Supabase
   callback URL (`https://<project>.supabase.co/auth/v1/callback`) and your app
   origins as authorized redirect URIs.
2. Enable the **Calendar**, **Tasks**, and **Gmail** APIs (for dashboard widgets).
3. In **Supabase → Authentication → Providers → Google**, paste the client ID +
   secret. Set Site URL and additional redirect URLs to your Vercel domain(s).

### 3.3 First admin

The first user to sign in is auto-promoted to **super_admin** (migration 002 +
`claim_super_admin_if_first()`), no manual SQL needed. Sign in with a
`@spectramanagement.net` account first to claim it.

---

## 4. Vercel setup

- **Framework preset:** Vite.
- **Build command:** `npm run build` (runs `tsc -b && vite build`).
- **Output directory:** `dist`.
- **Install command:** `npm install`.
- **Serverless functions:** files under `api/` are auto-deployed as functions.
- **SPA routing:** `vercel.json` rewrites all non-`/api/*` paths to `/index.html`
  so client-side routes work on refresh.

```json
// vercel.json
{
  "rewrites": [
    { "source": "/((?!api/.*).*)", "destination": "/index.html" }
  ]
}
```

---

## 5. Deploy

```bash
# Production deploy = push to main (Vercel auto-builds & promotes)
git push origin main
```

Pull requests / other branches get **Preview** deployments automatically. Set the
env vars for the Preview environment too, or previews against Supabase will fail
auth.

---

## 6. Pre-deploy verification

Run locally before pushing (these also gate CI):

```bash
npm run build          # type-check + production build, must be error-free
npm run test:run       # unit tests (payroll engine, PDF labels, …)
npm run check:imports  # no circular deps, no cross-module imports
npm run lint           # zero-warning ESLint
```

Then walk the [TEST_CHECKLIST.md](./TEST_CHECKLIST.md) against a Preview
deployment. Note its open items (e.g. tax rules are placeholders for MX/JM/PH/KE)
before sign-off.

---

## 7. Post-deploy smoke test

1. Visit the production URL → **Login** renders with company branding.
2. Sign in with a `@spectramanagement.net` Google account → lands on `/suite`.
3. Confirm a **non**-corporate account is rejected with the domain message.
4. Open **Nómina → Employees** (data loads from BambooHR via `/api/bamboohr`).
5. **Suite Settings → Audit Log** shows your `login` entry (paginated).
6. Run a small payroll → approve → send a paystub → verify `payroll_approved` and
   `paystub_sent` audit entries.

---

## 8. Rollback

- **Vercel:** Deployments → select the last good build → **Promote to Production**
  (instant; no rebuild).
- **Code:** revert the offending commit and push, or reset to the tagged safe
  point (e.g. `git reset --hard <tag>` on a hotfix branch).
- **Database:** migrations are additive/idempotent; avoid destructive changes.
  Take a Supabase backup/snapshot before running new migrations in production.

---

## 9. Operational notes

- **Bundle size:** the client ships a large `react-pdf` chunk (~1.3 MB). Acceptable
  for an internal tool; consider route/PDF code-splitting if first-load latency
  matters on slow links.
- **Secrets rotation:** rotate the Supabase service-role and Resend keys in Vercel
  env; no redeploy of code required (re-deploy to pick up new values).
- **Monitoring:** use Vercel function logs for `/api/*` errors and the Supabase
  dashboard for auth/SQL/RLS issues.
