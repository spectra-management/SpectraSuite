# CHECKPOINT.md — Spectra Payroll System

**Last updated:** 2026-06-15  
**Current Phase:** SYSTEM COMPLETE — UX improvements  
**Git branch:** main  
**Last commit:** feat: country-separated payroll (DR + US) — Opción A (5af8b5f2)

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

## Country-Separated Payroll — Opción A (2026-06-16)

| Area | Change | Files |
|------|--------|-------|
| **New: PayrollRules** | `types.ts` interface: country, currency, rates, caps, income-tax function, periods/year, OT threshold, holidays, daily divisor | `src/lib/payroll/rules/types.ts` |
| **New: DR rules** | `getDOPayrollRules(fiscal, payroll, frequency)` — AFP 2.87%, SFS 3.04%, DGII ISR brackets, quincena rule, DR holidays 2025–2026 | `src/lib/payroll/rules/do.ts` |
| **New: US rules** | `getUSPayrollRules(frequency)` — Social Security 6.2% (cap $168,600/yr), Medicare 1.45%, 2024 single-filer federal tax brackets, US federal holidays 2025–2026 | `src/lib/payroll/rules/us.ts` |
| **New: rules factory** | `getPayrollRules(country, frequency, fiscal, payroll)` — dispatches to US or DR, Unknown → DR fallback | `src/lib/payroll/rules/index.ts` |
| **Core calculation** | `CalculationInput` now uses `rules: PayrollRules` (replaces `fiscal` + `payroll`). Quincena rule gated to DR only. Inline pension/health cap logic. | `src/lib/payroll/calculations.ts`, `types.ts` |
| **BambooHR sync** | `country` field added to custom report fields + Employee mapping | `src/lib/connectors/bamboohr.ts` |
| **Types** | `country?: string` added to `Employee` and `PayrollPeriod` | `src/types/index.ts` |
| **Process Payroll Step 1** | Country selector (🇩🇴/🇺🇸/🌐) with active employee counts; filters `activeEmployees` by selected country; Unknown shows amber warning | `StepPeriod.tsx` |
| **Process Payroll Steps 2–4** | `country` threaded through all steps; StepCalculate calls `getPayrollRules`; StepApprove saves country to payroll record | `StepHours.tsx`, `StepCalculate.tsx`, `StepApprove.tsx`, `Payroll/index.tsx` |
| **Solo paystub modal** | `country` prop added; builds rules from `getPayrollRules` | `SinglePaystubModal.tsx` |
| **Employees page** | Country filter Select; flag emoji (🇩🇴/🇺🇸/🌐) next to each employee | `Employees/index.tsx` |
| **History** | Country filter Select; flag badge next to each payroll period | `History/index.tsx` |
| **Paystub PDF** | `makeFmt(currencySymbol)` for DR ($RD$) vs US ($); `COUNTRY_LABELS` selects AFP/SFS/ISR vs SS/Medicare/FIT labels dynamically | `payStubPdf.tsx` |
| **Tests** | 29 tests (was 27); uses `getDOPayrollRules` in `makeInput`; 2 new US tests (SS+Medicare amounts, no quincena for US) | `calculations.test.ts` |

---

## ISR Quincena Rule Fix (2026-06-16)

| Change | Files |
|--------|-------|
| **Formula correction**: ISR annualized from `gross × 24` (not `grossAfterTSS × 24`). Confirmed test case: Idaly Peña gross=28,000 → annual=672,000 → ISR=1,697.93/quincena | `src/lib/payroll/calculations.ts` |
| **1st quincena**: `isrPeriod = 0` (deferred). `isrCalculated` stores the deferred amount. Net pay does NOT deduct ISR. Amber notice shown in StepCalculate. | `calculations.ts`, `StepCalculate.tsx` |
| **2nd quincena**: `isrPeriod = isrCalculated + previousQuincenaIsr`. StepCalculate looks up 1st quincena payroll from history store (same month/year, startDate day=1); fallback = 2× current ISR if not found. Blue notice shown. | `StepCalculate.tsx` |
| **Paystub PDF**: 1st quincena → "Tax ISR: 0 + amber note". 2nd quincena → 3 rows: ISR 1ra Quincena / ISR 2da Quincena / Total ISR Retenido | `payStubPdf.tsx`, `SinglePaystubModal.tsx` |
| **Types**: `CalculationInput` + `CalculationResult` + `PayrollCalculation` get `isrCalculated` field. `quincena` and `previousQuincenaIsr` on input. | `types.ts`, `src/types/index.ts` |
| **Tests**: 27 total (was 20). 7 new tests: quincena rule, formula, Idaly Peña case | `calculations.test.ts` |
| **Known limitation**: OT threshold default was 44h in tests comments (now corrected to 40h) | constants.ts already correct |

---

## Paystub + Manager Report (2026-06-15)

| Improvement | Files |
|-------------|-------|
| MEJORA 1: Paystub exact format — all rows always visible, "PAYMENT DESCRIPTION/HOURS/RATE/TOTAL" header, Night Incentive row (0 default), all deduction rows with ► arrow, fixed named deductions (SFS, AFP, Pay Advance, Dependent TSS, ISR, ISR Salary=grossPay, Complementary Insurance), NET INCOME as last table row. File naming: Paystub_{Name}_{start}_{end}.pdf | `src/lib/pdf/payStubPdf.tsx`, `src/pages/Payroll/components/SinglePaystubModal.tsx` |
| MEJORA 2: Manager Report — A4 Landscape PDF with Executive Summary, Employee Detail table, Dept Summary, Signature footer. CSV export with BOM. Buttons in Step 4 (pre+post approval) and History per payroll row | `src/lib/pdf/managerReportPdf.tsx`, `src/lib/pdf/generateCsv.ts`, `src/pages/Payroll/components/StepApprove.tsx`, `src/pages/History/index.tsx` |
| New i18n keys: payAdvance, dependentTSS, complementaryIns, nightIncentive, managerReport.* | `src/locales/en.json`, `src/locales/es.json` |

---

## UX Improvements — Step 1 (2026-06-15)

| Improvement | Files |
|-------------|-------|
| MEJORA 1: Biweekly quincena picker — when frequency is Bi-weekly, replaces free date inputs with month+year selects + two quincena radio buttons (1st: 1–15, 2nd: 16–last day). Dates auto-computed, read-only. February leap year handled correctly. Weekly keeps free inputs. | `src/pages/Payroll/components/StepPeriod.tsx`, `src/locales/en.json`, `src/locales/es.json` |
| MEJORA 2: ISO week OT calculation — `groupDailyIntoWeeks` replaced with ISO week (Mon–Sun) bucketing. Iterates every day in period, groups by ISO week Monday, applies OT threshold per week. Fixes bug where 15-day biweekly periods missed the 15th day (2×7=14 days). OT threshold reads from settings (default 40 h). | `src/lib/connectors/hubstaff.ts` |

---

## UX Improvements — Step 2 (2026-06-15)

| Improvement | Files |
|-------------|-------|
| MEJORA 1: Back + Calculate Payroll buttons duplicated at top of Review Hours (Step 2) | `src/pages/Payroll/components/StepHours.tsx` |
| MEJORA 2: Per-row Calculator icon button opens SinglePaystubModal for solo employee preview with Download PDF + Send Email | `src/pages/Payroll/components/SinglePaystubModal.tsx`, `StepHours.tsx` |
| MEJORA 3: Paystub PDF redesigned — green EARNINGS table (Concept/Hours/Rate/Amount), dark DEDUCTIONS table with SFS, AFP, custom deductions, ISR DGII, "Salary for month applicable to ISR" (taxableIncome/12), company logo, Date Range + Pay Date header | `src/lib/pdf/payStubPdf.tsx` |
| New i18n keys for soloPaystub modal in EN + ES | `src/locales/en.json`, `src/locales/es.json` |
| StepHours `frequency` prop added to enable solo calculation with correct ISR annualization | `src/pages/Payroll/index.tsx` |

---

## Post-launch fixes (2026-06-12 → 2026-06-15)

| OT threshold default: 44h → 40h | `src/lib/payroll/constants.ts` |
| Employees page: Active filter by default, 3-option status (Active / Inactive+Terminated / All), localStorage persistence | `src/pages/Employees/index.tsx` |
| Levenshtein fuzzy-match button in mapping panel "By BambooHR Employee" view | `src/pages/Connectors/index.tsx` |
| Enhanced diagnostic log in findHubstaffUserForEmployee (shows all compared names when match fails) | `src/pages/Payroll/components/StepPeriod.tsx` |
| Fix pagination param in fetchHubstaffMembers: page[limit] → page_limit (members endpoint uses underscore, not brackets) | `src/lib/connectors/hubstaff.ts` |
| Pagination in fetchHubstaffMembers (20 pages × 100 = 2000 members, was truncating at 100) | `src/lib/connectors/hubstaff.ts` |
| SearchableSelect combobox in mapping panel (search by name+email, replaces shadcn Select for 100+ lists) | `src/pages/Connectors/index.tsx` |
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
