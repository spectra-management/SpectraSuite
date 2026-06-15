# CHECKPOINT.md — Spectra Payroll System

**Last updated:** 2026-06-16  
**Current Phase:** SYSTEM COMPLETE — Post-launch bug fixes  
**Git branch:** main  
**Last commit:** fix: Hubstaff bracket params + payType Hourly filter

---

## System Status: COMPLETE + POST-LAUNCH IMPROVEMENTS ✅

All phases (1–9) implemented and verified.

### Build Status
- ✅ `npm run test:run` → 20/20 tests passing
- ✅ `npm run typecheck` → clean
- ✅ `npm run build` → success, chunks split

### What Was Built (complete inventory)

| Phase | Module | Status |
|-------|--------|--------|
| 1 | Setup, i18n, agents, structure | ✅ |
| 2 | Payroll calculations (AFP/SFS/ISR/OT) + 20 tests | ✅ |
| 3 | BambooHR/Hubstaff/Email proxies + Connectors UI + Hubstaff mapping | ✅ |
| 4 | Employee table, profile page, custom deductions CRUD | ✅ |
| 5 | 4-step payroll flow (period → hours → calculate → approve) | ✅ |
| 6 | PDF pay stubs (EN/ES bilingual) + individual/batch email send | ✅ |
| 7 | Full settings (company/logo/payroll/fiscal params/email template) | ✅ |
| 8 | Dashboard with AreaChart + history with expandable rows | ✅ |
| 9 | QA pass: i18n completeness, bundle splitting, bug fixes | ✅ |

---

## Post-launch fixes (2026-06-12 → 2026-06-15)

| OT threshold default: 44h → 40h | `src/lib/payroll/constants.ts` |
| Employees page: Active filter by default, 3-option status (Active / Inactive+Terminated / All), localStorage persistence | `src/pages/Employees/index.tsx` |
| Levenshtein fuzzy-match button in mapping panel "By BambooHR Employee" view | `src/pages/Connectors/index.tsx` |
| Enhanced diagnostic log in findHubstaffUserForEmployee (shows all compared names when match fails) | `src/pages/Payroll/components/StepPeriod.tsx` |
| Pagination loop in fetchHoursForPeriod (50 pages × 500 records, token rotation between pages) | `src/lib/connectors/hubstaff.ts` |
| Mapping panel two-view toggle: "By Hubstaff User" + "By BambooHR Employee" with orange badge for unmapped count | `src/pages/Connectors/index.tsx` |
| Manual Hubstaff↔BambooHR mapping UI with User #ID display, auto-match-by-name button, progress counter, info note | `src/pages/Connectors/index.tsx` |
| "Needs Mapping" badge (orange) + unmapped-employees banner with link to Connectors in Review Hours | `src/pages/Payroll/components/StepHours.tsx` |
| fetchHubstaffMembers: Shape C fallback (flat members, no user details) → stub records with User #ID | `src/lib/connectors/hubstaff.ts` |
| Fix | Files |
|-----|-------|
| Hubstaff auth: refresh token ↔ access token exchange, token rotation | `api/hubstaff.ts`, `src/lib/connectors/hubstaff.ts`, `src/store/settingsStore.ts` |
| Hubstaff bracket params: `date[start]`/`date[stop]` now sent without percent-encoding | `api/hubstaff.ts`, `src/lib/connectors/hubstaff.ts` |
| BambooHR payType filter: only `Hourly` employees enter payroll flow | `src/pages/Payroll/components/StepPeriod.tsx` |
| Hours review: match status badges, filters, DR holiday banner, salaried section | `src/pages/Payroll/components/StepHours.tsx`, `src/lib/drHolidays.ts` |
| StepCalculate guard: rejects salaried employees with clear error UI | `src/pages/Payroll/components/StepCalculate.tsx` |
| Connectors: name-normalization fallback for Hubstaff auto-matching | `src/pages/Connectors/index.tsx` |
| Proxy logging: `console.log` for URL and response status on each call | `api/hubstaff.ts` |
| ErrorBoundary on Connectors page | `src/components/ErrorBoundary.tsx` |
| Select crash: `value=""` → `value="__none__"` sentinel | `src/pages/Connectors/index.tsx` |

## To Deploy

1. Set environment variables in Vercel (see `.env.example`)
2. `vercel deploy` or connect GitHub repo to Vercel
3. Vercel automatically detects framework (Vite) from `vercel.json`

---

## Post-Launch Improvements Applied (2026-06-12)

- BambooHR sync → custom report endpoint (fixes payRate, hireDate, status)
- Employee pay rate: currency-aware display (USD/$, DOP/RD$, empty=Not set amber)
- Status: uses employmentHistoryStatus (Active/Inactive/Terminated correctly)
- Employees table: Department/JobTitle/Status filters + accent-insensitive search
- Sortable columns: Name, Pay Rate, Hire Date (click header to toggle asc/desc)
- Employee Reports modal: Directory, Compensation, Headcount templates
- CSV + PDF export (lazy-loaded PDF, applies active filters, company branding)

## Known Technical Debt (low priority)

- OT week boundary uses period start, not calendar Monday (edge case only)
- Pay stub sends are sequential (not parallel) — by design for rate limits

---

## To Resume
If continuing work: `npm run test:run && npm run typecheck` to verify state.
