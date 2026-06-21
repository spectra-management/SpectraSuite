# Development — Spectra Suite

Everything you need to work on Spectra Suite locally. For the big picture see
[ARCHITECTURE.md](./ARCHITECTURE.md); for shipping see
[DEPLOYMENT.md](./DEPLOYMENT.md).

---

## 1. Prerequisites

- **Node.js 18+** and npm.
- A **Supabase** project (or access to the team's) with migrations applied — see
  [DEPLOYMENT.md §3](./DEPLOYMENT.md#3-supabase-setup).
- A `@spectramanagement.net` Google account (the app rejects other domains).

---

## 2. First-time setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#   then fill in VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,
#   and SUPABASE_SERVICE_ROLE_KEY (for /api/invite)

# 3. Start the dev server
npm run dev          # http://localhost:5173
```

> The Supabase **publishable** key is safe in the client. The **service-role** key
> is server-only (used by `api/invite.ts`); never import it into `src/`.

---

## 3. Daily commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | `tsc -b` (type-check, fails on unused locals/imports) + `vite build` |
| `npm run preview` | Serve the production build locally |
| `npm run test` | Vitest in watch mode |
| `npm run test:run` | Vitest once (CI mode) |
| `npm run test:ui` | Vitest UI |
| `npm run lint` | ESLint, **zero warnings allowed** |
| `npm run check:imports` | `madge --circular` + module-boundary check |

**Before every commit:** `npm run build && npm run test:run && npm run check:imports`.

---

## 4. Project conventions

### Module boundaries (enforced in CI)
- A module never imports another module — go through `shared`.
- `shared/**` never imports a feature (`modules/**`, `suite/**`).
- `shared/lib/**` never imports `shared/store/**`.
- No circular dependencies.

Full rules: [src/IMPORT_RULES.md](./src/IMPORT_RULES.md). Violations fail
`npm run check:imports`.

### Imports
- Use the `@/` alias (`@/shared/...`, `@/modules/nomina/...`), not deep relative
  paths.
- Prefer a module's `index.ts` barrel over reaching into its internals.

### TypeScript
- **No `any`.** All API responses and props are fully typed.
- `tsc -b` runs with `noUnusedLocals` / `noUnusedParameters` — dead code fails the
  build.

### Internationalization
- **Zero hardcoded UI strings.** Every label comes from
  `src/locales/{en,es}.json` via `useTranslation`.
- Keep `en.json` and `es.json` structurally in sync; English is the default.
- Tax terms (ISR, TSS, AFP, SFS, DGII) stay identical in both languages.

### Design system
- White base, **emerald primary** (`emerald-600`), Inter font.
- `rounded-xl` cards, `rounded-lg` buttons/inputs, soft shadows (`shadow-sm`).
- **lucide-react** icons only. Don't introduce other icon sets or accent colors.

### Money & payroll (Dominican Republic)
- Always round with `roundHalfUp(value, 2)` (`@/shared/lib/number`); never rely on
  default JS rounding.
- Daily divisor is **23.83**. Format as `RD$ 1,234.56`.
- TSS (AFP/SFS) is deducted **before** ISR. Fiscal parameters are configurable in
  Settings, so read them from the settings store — don't hardcode rates in UI.
- The payroll engine (`modules/nomina/lib/payroll/`) is **pure** — no UI imports —
  and is unit-tested.

---

## 5. Testing

- Framework: **Vitest** (+ jsdom for the PDF render test).
- Tests live in `__tests__/` next to the code they cover, e.g.
  `modules/nomina/lib/payroll/__tests__/calculations.test.ts`.
- The payroll engine has the densest coverage (ISR brackets, TSS caps, OT/holiday,
  rounding). **Add a test for any change to a calculation.**

```bash
npm run test:run        # all tests once
npm run test -- calculations   # focus a file in watch mode
```

---

## 6. Working with the backend

- **Supabase client:** `@/shared/lib/supabase` (`supabase`, `isSupabaseConfigured`,
  `signInWithGoogle`). The app degrades gracefully when Supabase env is absent.
- **Audit:** call `logAuditEvent({ action, category, ... })` from
  `@/shared/lib/audit` after any sensitive action. It's best-effort and never
  throws. Writes go through the `log_audit_event` RPC (table is read-only to
  clients).
- **Serverless proxies (`api/`):** the browser must call connectors through
  `/api/bamboohr` and `/api/hubstaff` (CORS + secrets). Email goes through
  `/api/email`; admin user invites through `/api/invite` (service-role).
- **Migrations:** add a new numbered file in `supabase/migrations/`; keep it
  idempotent (`if not exists`, `create or replace`). Never edit a shipped
  migration — add a new one.

---

## 7. Adding a feature module

The placeholder modules (`rrhh`, `facturacion`, `gastos`, `it`) are wired into
routing already (they render `ModuleShell`). To build one out:

1. Add pages under `src/modules/<module>/pages/` and any module-private
   `components/`, `hooks/`, `lib/`.
2. Export the public surface from `src/modules/<module>/index.ts`.
3. In `src/App.tsx`, replace the module's `<ModuleShell moduleId="…" />` route with
   real routes, wrapped in `<ProtectedRoute module="…" action="…">`.
4. Register/flip the module in `src/shared/lib/suiteModules.ts` (`active: true`).
5. Add i18n keys to `en.json` + `es.json`.
6. Keep imports inside the module or from `shared` — never from another module.
7. `npm run check:imports && npm run build && npm run test:run` must stay green.

---

## 8. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| `npm run check:imports` fails with "imports another module" | A module reached into a sibling — move the shared piece into `shared/`. |
| Build fails on an unused import/var | `tsc -b` is strict — remove it or use it. |
| Login bounces to `/login` with a domain message | The Google account isn't `@spectramanagement.net` (by design). |
| "infinite recursion detected in policy for relation profiles" | Migration **003** not applied. Run it. |
| `relation "audit_log" does not exist` | Run migration **005** before **007**. |
| Google widgets show "Reconnect Google" | The cached `provider_token` expired — reconnect to re-grant scopes. |
| Connector calls fail with CORS | Call via `/api/bamboohr` / `/api/hubstaff`, never the vendor API directly. |

---

## 9. Git & CI

- Branch off `main`; open a PR. Vercel builds a Preview per PR.
- CI runs `madge --circular` + the boundary check (`scripts/check-imports.mjs`) via
  `.github/workflows/ci.yml`.
- Commit only when asked; keep secrets out of commits (`.env.local` is git-ignored;
  `.env.example` holds placeholders only).
