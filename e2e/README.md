# e2e — Browser / UI verification (Playwright)

Browser tests + screenshots used to confirm the UI renders correctly (see AGENTS.md §2a).

## Commands

```bash
npm run e2e:install   # first time on a machine: download the browser
npm run test:e2e      # starts the Vite dev server and runs the specs in e2e/
npm run test:e2e:ui   # interactive UI mode
```

Reuse a dev server you already started:

```bash
PW_BASE_URL=http://localhost:5173 npm run test:e2e
```

## Screenshots

Use the helper to capture a reviewable image:

```ts
import { screenshot } from './helpers'
await page.goto('/rrhh/org')
await screenshot(page, 'org-chart')   // -> e2e/screenshots/org-chart.png
```

Screenshots land in `e2e/screenshots/` (git-ignored). Open the PNG and confirm the render.

## Auth note

Most screens are behind login. The app bypasses auth when no `VITE_SUPABASE_*` env vars are
set, so running the e2e dev server without Supabase config makes every screen reachable for
screenshots. Otherwise, sign in within the spec first.
