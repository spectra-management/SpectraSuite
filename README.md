# Spectra Suite

**One platform. Every team. Anywhere.**

A modular, enterprise-grade business operations platform for global teams. Handle payroll, HR, billing, expenses, and IT assets — all in one place.

## Features

### 🏢 Nómina (Payroll)
- Multi-country payroll (DO, MX, US, JM, PH, KE, Global)
- Multiple frequencies (Weekly, Biweekly, Full Month)
- Automatic tax calculation (DGII for DR, IRS for US; placeholders for others)
- Salary + hourly employees
- Holiday bonus & night shift premiums
- BambooHR + Hubstaff integration
- Email paystubs with PDF download
- Audit trail (tamper-proof server-side logging)
- Vacation pay with seniority tiers

### 🔐 Security
- Google OAuth (@spectramanagement.net only)
- Role-Based Access Control (RBAC) with granular permissions
- Row-Level Security (RLS) in Supabase
- Session timeout (configurable by super admin)
- Tamper-proof audit log (SECURITY DEFINER RPC)
- No secrets in codebase (env-driven config)

### 📊 Dashboard
- Google Calendar integration (upcoming 7-day events)
- Google Tasks (add/complete/delete)
- Recent Gmail emails
- Module summaries per user role

### 🔄 Coming Soon
- **RRHH (HR)** — employee management, departments, time-off requests
- **Facturación (Billing)** — invoices, clients, payments
- **Gastos (Expenses)** — expense tracking, approvals
- **IT (Assets)** — computer/license inventory, assignments

## Stack

- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (PostgreSQL + Auth) + Vercel Serverless
- **State:** Zustand + TanStack Query
- **Integrations:** BambooHR, Hubstaff, Google (Calendar, Tasks, Gmail), Resend (email)

## Quick Start

```bash
# Install
npm install

# Dev server
npm run dev

# Build
npm run build

# Check imports & circular deps
npm run check:imports

# Deploy to Vercel
git push origin main
```

## Project Structure

```
.
├── api/                     # Vercel serverless functions
│   ├── bamboohr.ts          # BambooHR proxy (CORS)
│   ├── hubstaff.ts          # Hubstaff proxy + OAuth token exchange
│   ├── email.ts             # Paystub email (Resend / SMTP)
│   └── invite.ts            # Admin: invite users (service-role)
├── src/
│   ├── modules/             # Isolated, independently-deployable feature modules
│   │   ├── nomina/          # Payroll (active) — pages/ + lib/ (engine, pdf, connectors)
│   │   ├── rrhh/            # HR (placeholder)
│   │   ├── facturacion/     # Billing (placeholder)
│   │   ├── gastos/          # Expenses (placeholder)
│   │   └── it/             # IT assets (placeholder)
│   ├── shared/              # Cross-cutting layer (any module may import)
│   │   ├── components/      # UI primitives, layout, ProtectedRoute, ErrorBoundary
│   │   ├── context/         # AuthContext, ThemeContext
│   │   ├── hooks/           # useAuditLog, useToast, …
│   │   ├── lib/             # supabase, audit, google, payroll-defaults, utils
│   │   ├── store/           # Zustand stores (settings, payroll, employees, …)
│   │   └── types/           # Shared TypeScript types
│   ├── suite/               # Suite shell — home (launcher + dashboard) + settings
│   ├── pages/               # Top-level public pages (Login)
│   ├── locales/             # i18n resources (en.json, es.json)
│   ├── App.tsx              # Routing / composition root
│   └── main.tsx             # Entry point
├── supabase/migrations/     # SQL migrations 001–007 (idempotent)
├── scripts/check-imports.mjs# Module-boundary CI check
└── docs                     # README · ARCHITECTURE · DEPLOYMENT · DEVELOPMENT
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, module boundaries, data model, security model |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Production deploy to Vercel + Supabase, env vars, migrations |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Local setup, conventions, testing, adding a module |
| [TEST_CHECKLIST.md](./TEST_CHECKLIST.md) | Pre-deployment QA checklist |
| [src/IMPORT_RULES.md](./src/IMPORT_RULES.md) | Module isolation rules (enforced in CI) |

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values. See [DEPLOYMENT.md](./DEPLOYMENT.md#environment-variables) for the full table.

| Variable | Scope | Required | Purpose |
|----------|-------|----------|---------|
| `VITE_SUPABASE_URL` | client + server | ✅ | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client | ✅ | Supabase publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | server | ✅ | Service role for `/api/invite` admin actions |
| `BAMBOOHR_API_KEY` / `BAMBOOHR_SUBDOMAIN` | server | ⬜ | Optional fallback; connectors are normally configured in-app |
| `RESEND_API_KEY` | server | ⬜ | Optional fallback; email is normally configured in-app |

> **Never commit real secrets.** Connector and email credentials are entered at
> runtime through **Connectors** settings and stored per-tenant, not in the repo.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (http://localhost:5173) |
| `npm run build` | Type-check (`tsc -b`) + production build |
| `npm run preview` | Preview the production build locally |
| `npm run test` / `npm run test:run` | Vitest (watch / single run) |
| `npm run lint` | ESLint (zero-warning policy) |
| `npm run check:imports` | Circular-dependency + module-boundary check |

## License

Proprietary — © Spectra Management. All rights reserved.
