# Import Rules — Module Isolation & Scalability

> These rules are enforced in CI by `npm run lint:imports`
> (`scripts/check-imports.mjs` + `madge --circular`). A violation fails the build.

## Golden Rule
**A feature module cannot import from another feature module directly.**

Modules communicate only through the **shared** layer. This lets each module be
developed, tested, and changed independently without breaking the others.

## Actual structure

This is a Vite + React app (not Next.js). Each feature is an isolated module under
`src/modules/`; cross-cutting code lives in `src/shared/`; the Spectra Suite shell
lives in `src/suite/`. The only thing left at the top level is the composition root
(`App.tsx`, `main.tsx`) and the public `pages/Login.tsx`.

```
src/
├── modules/              ← Feature modules (isolated, independently deployable)
│   ├── nomina/           ← Payroll (DR): the existing app
│   │   ├── pages/        ← Dashboard, Employees, Payroll, History, Connectors, Settings
│   │   ├── lib/          ← payroll engine, connectors, pdf, reports, holidays, vacations
│   │   ├── components/ · hooks/ · context/ · types/   ← module-private (currently empty)
│   │   └── index.ts      ← module public API (barrel)
│   ├── rrhh/ · facturacion/ · gastos/ · it/   ← placeholders (render <ModuleShell> "Coming Soon")
│   └── …
├── shared/               ← Cross-cutting code — available to ALL modules
│   ├── lib/              ← framework-light logic: number, storage, supabase, audit,
│   │   │                   cloudSync, google, suiteModules, payroll-defaults, utils/
│   │   └── …             ← (no UI imports; stays feature-agnostic)
│   ├── components/       ← Shared UI (ui/ primitives, layout/, ProtectedRoute, ThemeToggle, …)
│   ├── context/          ← Cross-cutting React context (AuthContext, ThemeContext)
│   ├── store/            ← Zustand stores
│   ├── hooks/            ← Shared hooks
│   ├── types/            ← Type definitions (bottom layer)
│   └── index.ts          ← shared public API (context/hooks/store/types; see note below)
├── suite/                ← Spectra Suite shell (cross-module landing surface)
│   ├── pages/            ← SuiteHome, SuiteSettings, components/
│   └── index.ts
├── pages/                ← Top-level public pages only (Login.tsx)
├── App.tsx · main.tsx    ← Composition root (wires modules + suite + shared)
└── locales/              ← i18n resources
```

## Layering (allowed direction of imports)

Higher layers may import lower layers, never the reverse:

```
shared/types  ←  shared/lib  ←  shared/store · shared/context  ←  shared/components
                                                                          ↑
                                  modules/<X>  ·  suite   ──────────────────┘
                                  (features import shared, never each other)
```

- **`modules/<A>`** may import from `shared/**` and its own `modules/<A>/…` files.
  It may **not** import from `modules/<B>`.
- **`shared/**`** must stay feature-agnostic: **no** imports from `modules/**` or
  `suite/**`. If a module needs a shared default, it lives in `shared` and the module
  re-exports it (e.g. `shared/lib/payroll-defaults` → re-exported by
  `modules/nomina/lib/payroll/constants`; `shared/lib/number` → re-exported by the
  payroll engine).
- **`shared/lib/**`** is the foundation: additionally **no** imports from
  `shared/store/**` (it stays UI- and state-agnostic). `payroll/` is UI-free — no
  React/component imports.
- **`suite/`** may import `shared/**`; it wires modules together through routing in the
  composition root, not by reaching into module internals.
- **`App.tsx` / `main.tsx`** are the composition root and are exempt — they may import
  modules, suite and shared by design.
- Always import via the `@/` alias (`@/shared/lib/...`, `@/modules/nomina/...`) rather
  than long relative chains. Cross-module relative escapes (`../../otherModule`) are
  forbidden.

## Barrels (`index.ts`)
Each module and the suite expose a public API through an `index.ts` barrel. Prefer
importing a module's public surface from its barrel over deep paths.

> Note: `shared/index.ts` re-exports `context`, `hooks`, `store`, and `types` only.
> `shared/lib` and `shared/components` are **not** re-exported at the top level because
> they expose overlapping names (e.g. two `formatCurrency` helpers in `lib/utils.ts`
> vs `lib/utils/currency.ts`); import those from their explicit paths.

## No circular dependencies
A → B → A chains are rejected by `madge --circular` in CI. Keep dependencies acyclic;
if two files need each other, extract the shared piece into `shared/lib` / `shared/types`.

## How modules coordinate
The **Suite** (`src/suite`) is the landing surface and, together with the composition
root, the coordinator: the module registry lives in `src/shared/lib/suiteModules.ts`,
and cross-module settings (users, roles, audit, company) live in `suite` + `shared`.
Modules expose behavior through `shared`, and the Suite/App wire them together —
modules never reach into each other.

## Running the checks locally
```bash
npm run lint:imports   # boundary check + circular-dependency scan
npm run build          # tsc -b also fails on unused imports/locals
```
