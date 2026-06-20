# Import Rules — Module Isolation & Scalability

> These rules are enforced in CI by `npm run lint:imports`
> (`scripts/check-imports.mjs` + `madge --circular`). A violation fails the build.

## Golden Rule
**A feature module cannot import from another feature module directly.**

Modules communicate only through **shared** code. This lets each module be
developed, tested, and changed independently without breaking the others.

## Actual structure

This is a Vite + React app (not Next.js). Feature "modules" live under `src/pages/`;
everything reusable lives in the shared layers:

```
src/
├── pages/                ← Feature modules (one folder per module)
│   ├── Suite/            ← Meta-platform: home, settings, the module coordinator
│   ├── Dashboard/        ← Nómina · dashboard
│   ├── Employees/
│   ├── Payroll/          ← Process Payroll (StepPeriod → StepHours → StepCalculate → StepApprove)
│   ├── History/
│   ├── Connectors/
│   ├── Settings/
│   ├── Login.tsx · AccessDenied.tsx
│   └── …
├── lib/                  ← Shared, framework-light logic — available to ALL modules
│   ├── payroll/          ← Pure calculation engine (NO UI imports)
│   ├── connectors/       ← BambooHR / Hubstaff clients
│   ├── pdf/ · utils/ · supabase.ts · audit.ts · cloudSync.ts · google.ts · holidays.ts
├── components/           ← Shared UI (ui/ primitives, layout/, ThemeToggle, …)
├── contexts/             ← Cross-cutting React context (AuthContext, ThemeContext)
├── store/                ← Zustand stores
├── hooks/                ← Shared hooks
├── types/                ← Type definitions (bottom layer)
└── locales/              ← i18n resources
```

## Layering (allowed direction of imports)

Higher layers may import lower layers, never the reverse:

```
types  ←  lib  ←  store / contexts  ←  components  ←  pages
                 (shared) ───────────────────────────┘
```

- **`pages/<A>`** may import from `lib`, `components`, `contexts`, `store`, `hooks`,
  `types`, and its own `pages/<A>/…` files. It may **not** import from `pages/<B>`.
- **`lib/**`** must stay feature-agnostic: **no** imports from `pages/` or `store/`.
  (`lib/payroll/` is additionally UI-free — no React/component imports.)
- **`components/`, `contexts/`, `store/`, `hooks/`** are shared; keep them free of
  `pages/` imports.
- Always import via the `@/` alias (`@/lib/...`, `@/components/...`) rather than long
  relative chains. Cross-module relative escapes (`../../OtherModule`) are forbidden.

## No circular dependencies
A → B → A chains are rejected by `madge --circular` in CI. Keep dependencies acyclic;
if two files need each other, extract the shared piece into `lib`/`types`.

## How modules coordinate
The **Suite** (`src/pages/Suite`) is the coordinator: it owns the module registry
(`src/lib/suiteModules.ts`), routing entry points, and cross-module settings (users,
roles, audit, company). Modules expose behavior through shared `lib`/`store`, and the
Suite wires them together — modules never reach into each other.

## Running the checks locally
```bash
npm run lint:imports   # boundary check + circular-dependency scan
npm run build          # tsc -b also fails on unused imports/locals
```
