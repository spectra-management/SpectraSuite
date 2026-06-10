# CHECKPOINT.md — Spectra Payroll System

**Last updated:** 2026-06-10  
**Current Phase:** Phase 9 (Final QA Pass) — all features built  
**Git branch:** main  
**Last commit:** feat: Phases 3-8

---

## Current State

Phases 1–8 are fully implemented. The system is functionally complete.

### Build Status
- ✅ `npm run test:run` → 20/20 tests passing
- ✅ `npm run typecheck` → clean
- ✅ `npm run build` → success (bundle warning for @react-pdf — not an error)

### What's Built
- **Fase 1:** Project setup, i18n (EN/ES 100%), agents, folder structure
- **Fase 2:** Pure payroll calculations — AFP, SFS, ISR (4 brackets), OT, holidays, rounding
- **Fase 3:** Connectors — BambooHR proxy, Hubstaff proxy (with query forwarding), email proxy, Hubstaff mapping UI, Email connector
- **Fase 4:** Employee list with sync, employee profile page (`/employees/:id`), custom deductions CRUD
- **Fase 5:** Full 4-step payroll flow (period → hours review → calculate → approve)
- **Fase 6:** PDF pay stubs (bilingual), individual download, email send, batch send with progress
- **Fase 7:** Complete settings — company/logo upload, payroll, fiscal params (editable ISR table), email template
- **Fase 8:** Dashboard with AreaChart, history with expandable rows

---

## Next Steps (Phase 9 — Final QA)

1. **Bundle optimization:** Add `rollupOptions.output.manualChunks` to split `@react-pdf/renderer` into its own chunk. This reduces initial load time significantly.

2. **i18n audit:** Verify zero hardcoded strings remain after all pages were built. Any strings in Dashboard's "BambooHR" warning and payroll step messages need translation keys.

3. **Badge 'info' variant:** History page casts 'sent' status — add proper `info` variant to Badge component.

4. **`addDeduction` function:** Store accepts `Omit<CustomDeduction, 'id'>` but internally uses `generateId()`. Verify the store's `generateId` function is correct (it is — confirmed in store code).

5. **Final typecheck pass** after QA fixes.

---

## Known Issues / Technical Debt

- Bundle size: 2.2MB unminified (698KB gzip) — acceptable for an internal tool, but can be improved with code splitting for @react-pdf/renderer
- Badge component missing 'info' variant — using default cast as workaround in History page
- Hubstaff weekly OT split uses period start as week start (may not align to calendar Mon–Sun) — documented limitation
- `history.status` never updates to 'sent' after batch send — would need `updatePayroll` call in History page
- No pagination on Employees table (would need with large employee counts)

---

## Decisions Made

- `@react-pdf/renderer` used for PDF (alternative: `pdf-lib` or jsPDF). render/toBlob is async; browser-safe.
- ISR calculation: annualize by × periodsPerYear (24 biweekly / 52 weekly), compute annual ISR, divide back. Standard approach per DGII guidelines.
- OT calculated per week within the period (not on total period hours) — correct per Código Laboral RD
- Pay stubs support both EN and ES (configured in Settings → Email → Pay Stub Language)
- Batch email uses sequential fetch (not parallel) to respect rate limits
- localStorage prefix `spectra_` for all storage keys
