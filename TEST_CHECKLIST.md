# Spectra Suite — Testing Checklist

> **How to use this document.** The checkboxes below are for a human tester to
> execute against a running build. They are left unchecked on purpose.
>
> A static code audit was run first (2026-06-20) to pre-flag claims that the code
> does **not** currently support. Those appear as `> ⚠ Audit:` notes under the
> relevant item and are collected, with severity, under **Issues Found** at the
> bottom. Treat a flagged item as "expected to fail until fixed."

## Pre-Deployment Testing

### 1. Authentication & Security
- [ ] Login with Google works
  - [ ] First time login shows permission prompt (Calendar, Tasks, Gmail)
  - [ ] Second time login only asks which account
  - [ ] Redirects to /suite on success
  - [ ] Non-@spectramanagement.net email is rejected
  > ⚠ Audit: **NOT IMPLEMENTED.** No email-domain restriction exists anywhere
  > (frontend, `AuthContext`, `api/invite.ts`, or Supabase RLS/migrations). Any
  > Google account can authenticate. See Issue #1.
- [ ] Session timeout works
  - [ ] Warning appears 5 min before timeout
  > ⚠ Audit: Warning fires at **95% of the timeout**, not a fixed 5 min. With the
  > default 8 h timeout that is ~24 min of notice. Timeout is configurable
  > (`company_settings.session_timeout_minutes`, 5–1440 min). See Issue #8.
  - [ ] Can click "Stay Logged In" to extend
  - [ ] Auto-logout happens at configured timeout
- [ ] Logout clears localStorage and redirects to /login
- [ ] Password-less (only Google) — no password storage

### 2. Suite Home & Navigation
- [ ] Suite Home displays correctly
  - [ ] 5 module cards visible (Nómina, RRHH, Facturación, Gastos, IT)
  - [ ] Nómina card shows "Active →"
  - [ ] Other cards show "Coming Soon"
  > ⚠ Audit: The active module is indicated by a **green dot**, not the literal
  > text "Active →"; inactive modules are visually muted but the launcher button
  > does not print "Coming Soon" (that badge shows on the placeholder page after
  > you click in). Cosmetic mismatch only. See Issue #8.
  - [ ] Click Nómina → navigates to /nomina
  - [ ] Click other cards → Coming Soon page with sidebar
- [ ] Back to Suite button works from all modules
- [ ] Language toggle (ES/EN) works across all pages
- [ ] Dark mode toggle works across all pages
- [ ] User menu (avatar) shows and can logout

### 3. Suite Dashboard
> ⚠ Audit: There is no separate "/dashboard" route — **Suite Home _is_ the
> dashboard**. The cards below live on `src/suite/pages/SuiteHome.tsx` (Calendar,
> Tasks, Emails widgets + module summary). All verified present.
- [ ] Calendar card displays
  - [ ] Shows next 7 days of Google Calendar events
  - [ ] Click event → opens Google Calendar in new tab
  - [ ] If no calendar: "Connect Google Calendar" button works
  > ⚠ Audit: Fallback button is labeled "Reconnect Google" (calls
  > `signInWithGoogle(true)`), not "Connect Google Calendar". Cosmetic.
- [ ] Tasks card displays
  - [ ] Shows Google Tasks
  - [ ] Can add/complete tasks
  - [ ] Fallback to localStorage if Google not connected
- [ ] Recent Emails card displays
  - [ ] Shows last 5 Gmail emails
  - [ ] Shows sender, subject, time
  - [ ] Click email → opens in Gmail
- [ ] Module summary cards show:
  - [ ] Nómina: next payroll date, employee count, last payroll total
  - [ ] RRHH: Coming Soon
  - [ ] Facturación: Coming Soon
  - [ ] Gastos: Coming Soon
  - [ ] IT: Coming Soon

### 4. Nómina Module — Basic
- [ ] Dashboard loads
  - [ ] Shows payroll stats
  - [ ] Shows recent transactions
- [ ] Employees page loads
  - [ ] Table shows all employees
  - [ ] Can search by name
  - [ ] Filter tabs work (All, With Hours, Zero Hours)
  - [ ] Can click employee → opens profile
- [ ] Sidebar collapses/expands correctly
  - [ ] Icon-only view on collapse
  - [ ] Full labels on expand
  - [ ] Persists state in localStorage

### 5. Nómina Module — Payroll Processing
- [ ] Process Payroll (Step 1) loads
  - [ ] Country selector shows: DO, MX, US, JM, PH, KE, Global
  > ⚠ Audit: The country list is built **dynamically from the employees' own
  > `country` field** (plus a "Global" option), not a fixed DO/MX/US/JM/PH/KE
  > menu. A country only appears if an active employee has it. See Issue #8.
  - [ ] Period selector shows: Biweekly, Weekly, Full Month
  - [ ] Can select fortnight (1st/2nd) for Biweekly
  - [ ] Can select month/year for Full Month
  - [ ] Custom dates work
- [ ] Step 2 (Review Hours) loads
  - [ ] Shows employees for selected period
  - [ ] Filter tabs work
  - [ ] Pay rates show correct currency (RD$, MX$, $, etc)
  - [ ] Holiday hours calculated correctly (includes in total, 100% bonus)
  - [ ] Night shift hours show (if applicable)
- [ ] Step 3 (Calculate) loads
  - [ ] ISR calculated per country rules
  > ⚠ Audit: **Only Dominican Republic and United States have real tax rules.**
  > Mexico, Jamaica, Philippines, and Kenya fall through to a default ruleset
  > with **0% income tax and 0% pension/health** — net = gross for those
  > countries. See Issue #2.
  - [ ] AFP/SFS deductions correct
  - [ ] Gross and Net totals display
  - [ ] Can review before approving
- [ ] Step 4 (Approve & Send) loads
  - [ ] Paystub preview shows correctly
  - [ ] Can download paystub PDF
  - [ ] Can send paystub by email
  - [ ] Audit log records the action
  > ⚠ Audit: **Payroll _approval_ is logged** (`payroll_approved`), but the
  > **paystub _send_ is not** — neither single send nor bulk send calls
  > `logAuditEvent`. See Issue #3.

### 6. Nómina Module — Data
- [ ] Employees page
  - [ ] BambooHR employees loaded
  - [ ] Salary employees show $X/month, hourly show $X/hour
  > ⚠ Audit: The employee profile renders **`$X/hr` for everyone**, regardless of
  > `payType`. Salary employees are not shown as `/month`. See Issue #5.
  - [ ] Bank account info shows (if configured)
- [ ] Settings → Company
  - [ ] Can upload company logo
  - [ ] Logo appears on login page + paystubs
  - [ ] Can change company name, RNC, address
  > ⚠ Audit: Company name/logo/RNC are managed at **Suite Settings** level; the
  > Nómina → Company tab links there rather than editing inline. Not a defect.
- [ ] Settings → Connectors
  - [ ] BambooHR connector configured with subdomain + API key
  - [ ] Can test connection
  - [ ] Hubstaff connector configured with token + org ID
  - [ ] Can test connection
- [ ] Settings → Holidays
  - [ ] Auto-sync from Nager.Date works
  - [ ] Can add manual holidays
  - [ ] Holidays affect payroll (holiday bonus calculated)
- [ ] Settings → Vacation Rules
  - [ ] Seniority tiers configured (DR: 14/18/23 days)
  - [ ] Vacation pay calculated correctly
  - [ ] SFS/AFP/ISR deductions toggle works

### 7. Roles & Permissions
- [ ] Suite Settings → Roles tab (super admin only)
  - [ ] Shows 6 system roles (Super Admin, Payroll Manager, HR Manager, Finance Director, Payroll Viewer, HR Viewer)
  - [ ] Can create custom role
  - [ ] Can assign permissions per module (view, edit, approve, admin)
  - [ ] Can edit/delete custom roles
- [ ] Suite Settings → Users tab (super admin only)
  - [ ] Can invite user by email
  - [ ] Can assign multiple roles to user
  - [ ] User permissions aggregate correctly (OR logic)
  - [ ] Removing role removes access
- [ ] User with "Payroll Manager" role:
  - [ ] Can view Nómina
  - [ ] Can edit Nómina
  - [ ] Can approve payroll
  - [ ] Cannot access RRHH (shows Access Denied)
- [ ] User with "Payroll Viewer" role:
  - [ ] Can view Nómina
  - [ ] Cannot edit Nómina (buttons disabled)
  > ⚠ Audit: Enforcement is **route-level + sidebar-level** (locked nav items are
  > greyed out, edit/approve routes are guarded). Individual action buttons
  > _inside_ an already-open page are not separately disabled. The viewer is
  > blocked from reaching edit surfaces, but the claim "buttons disabled" is only
  > partially literal. See Issue #6.
  - [ ] Cannot approve payroll
- [ ] Super admin:
  - [ ] Can access ALL modules
  - [ ] Can edit roles/users/settings

### 8. Audit Log
- [ ] Suite Settings → Audit Log tab (super admin only)
  - [ ] Loads audit log table with pagination
  - [ ] Shows: timestamp, user, action, category, resource, status
  - [ ] Can filter by action, user, status
  - [ ] Pagination works (Previous/Next buttons)
  - [ ] Shows X entries per page (25 default)
- [ ] Audit entries recorded for:
  - [ ] User login
  - [ ] User logout
  - [ ] Session timeout
  - [ ] Payroll approved
  - [ ] Paystub sent
  > ⚠ Audit: **NOT WIRED.** Paystub email sending (single + bulk) does not emit a
  > `paystub_sent` event. Every other event in this list is wired. See Issue #3.
  - [ ] Role assigned/removed
  - [ ] Settings changed

### 9. Placeholder Modules (RRHH, Facturación, Gastos, IT)
- [ ] Navigate to each module (/rrhh, /facturacion, /gastos, /it)
  - [ ] Coming Soon page displays
  - [ ] Sidebar shows module name + placeholder nav items
  - [ ] Back to Suite button works
  - [ ] Language toggle works
  - [ ] Dark mode works
- [ ] Non-authenticated users:
  - [ ] Cannot navigate to modules (redirected to /login)

### 10. Responsive Design (Mobile)
- [ ] Login page works on mobile (single column)
- [ ] Suite home responsive (module cards stack on small screens)
- [ ] Nómina sidebar collapses on mobile (hamburger menu appears)
- [ ] Tables have horizontal scroll on mobile
- [ ] Modals (paystub preview, roles, users) work on mobile
- [ ] All buttons/inputs are tappable (44px minimum)
> ⚠ Audit: Mobile drawer + hamburger + `overflow-x-auto` tables are implemented
> (`md:` breakpoint). No dedicated 44px tap-target sizing or `sm:` refinements
> were found — verify tap targets manually on a real device. See Issue #7.

### 11. Performance
- [ ] App loads in < 3 seconds on 4G
- [ ] No console errors (only warnings allowed)
- [ ] No memory leaks (check DevTools Performance)
- [ ] Large payroll runs (100+ employees) don't freeze UI
- [ ] Pagination doesn't reload entire audit log
> ⚠ Audit: Audit-log pagination is server-side (`.range()` in `useAuditLog`), so
> this one is structurally satisfied. The main bundle is large (~737 kB JS +
> ~1.3 MB react-pdf, no code-splitting) — the < 3 s/4G target is at risk. See Issue #9.

### 12. Error Handling
- [ ] Network error → shows error message, can retry
- [ ] BambooHR connection fails → shows error, graceful fallback
- [ ] Hubstaff connection fails → shows error, graceful fallback
- [ ] Supabase connection fails → shows error, can retry
- [ ] Invalid data → form validation shows errors
> ⚠ Audit: Form validation reports via **toast only** — no inline field errors /
> `aria-invalid`. Connector + API + Supabase error handling is solid (toasts,
> HTTP-status checks, graceful degradation). See Issue #7.
- [ ] Logout during action → redirects to login
> ⚠ Audit: **`<ErrorBoundary>` is defined but only wraps the Connectors page** —
> it is not mounted at App/Layout/`main.tsx` root. An uncaught render error
> anywhere else white-screens the whole app. See Issue #4.

---

## Issues Found (if any)

Found during the static code audit (2026-06-20). Severity: 🔴 High · 🟠 Medium · 🟡 Low.

- [ ] **Issue #1 — 🔴 No email-domain restriction (security).**
  "Non-@spectramanagement.net email is rejected" is not implemented. There is no
  domain allow-list in the frontend, `AuthContext`, `api/invite.ts`, or any
  Supabase RLS policy / migration — any Google account can sign in.
  Files: `src/shared/lib/supabase.ts` (`signInWithGoogle`),
  `src/shared/context/AuthContext.tsx`, `api/invite.ts`.

- [ ] **Issue #2 — 🔴 Tax rules only exist for DR and US (payroll correctness).**
  Mexico, Jamaica, Philippines, and Kenya resolve to `getDefaultPayrollRules()`,
  which applies 0% income tax and 0% pension/health, so net = gross for those
  countries. Either implement their tax engines or block payroll for unsupported
  countries.
  Files: `src/modules/nomina/lib/payroll/rules/index.ts:36`,
  `src/modules/nomina/lib/payroll/rules/default.ts`.

- [ ] **Issue #3 — 🟠 `paystub_sent` audit event not wired (compliance).**
  Single send (`SinglePaystubModal.tsx`) and bulk send (`History/index.tsx`)
  email paystubs without calling `logAuditEvent`. Section 8 claims this is
  recorded; it is not. Add a `paystub_sent` (category `payroll`) event at both
  send sites.
  Files: `src/modules/nomina/pages/Payroll/components/SinglePaystubModal.tsx`,
  `src/modules/nomina/pages/History/index.tsx`.

- [ ] **Issue #4 — 🟠 ErrorBoundary not mounted at the root (robustness).**
  `ErrorBoundary` is defined and only wraps the Connectors page. A render error
  on any other screen takes down the entire app (white screen) with no recovery
  UI. Wrap the router/`<Layout>` (and ideally the app in `main.tsx`).
  Files: `src/shared/components/ErrorBoundary.tsx`, `src/main.tsx`, `src/App.tsx`.

- [ ] **Issue #5 — 🟠 Employee pay rate always shows "/hr" (display).**
  The employee profile renders `formatCurrency(payRate, country)/hr` for everyone,
  ignoring `payType`. Salary employees should display `/month`. Misleading for
  salaried staff.
  File: `src/modules/nomina/pages/Employees/EmployeeProfile.tsx:192-196`.

- [ ] **Issue #6 — 🟠 Action enforcement is route/sidebar-level, not per-button.**
  Viewers are blocked from edit/approve _routes_ and see locked sidebar items,
  but action buttons inside an already-open page are not individually disabled
  via `hasModuleAccess(...)`. Add inline `disabled` guards on edit/approve
  controls for defense-in-depth.
  Files: `src/shared/components/ProtectedRoute.tsx`,
  `src/shared/components/layout/Sidebar.tsx`.

- [ ] **Issue #7 — 🟡 Toast-only form validation + unverified mobile tap targets (UX/a11y).**
  Forms surface validation via toast with no inline field errors or
  `aria-invalid`. No 44px tap-target sizing was found for mobile. Add field-level
  error states and confirm touch targets on device.
  Files: `src/modules/nomina/pages/Settings/HolidaysTab.tsx`,
  `src/modules/nomina/pages/Connectors/index.tsx`, et al.

- [ ] **Issue #8 — 🟡 Checklist-wording mismatches (cosmetic / doc accuracy).**
  Not bugs, but the running app differs from the checklist text: (a) active module
  shown by a green dot, not "Active →"/"Coming Soon" labels; (b) Step-1 country
  list is dynamic from employee data, not a fixed DO/MX/US/JM/PH/KE menu;
  (c) session-timeout warning is at 95% of the (configurable) timeout, not a fixed
  5 min; (d) Calendar fallback button reads "Reconnect Google".

- [ ] **Issue #9 — 🟡 Large bundle, no code-splitting (performance).**
  Production build ships ~737 kB main JS + ~1.3 MB `react-pdf` with no route/PDF
  code-splitting, putting the "< 3 s on 4G" target at risk. Consider
  `import()`-splitting the PDF renderer and heavy routes.
  File: `vite` build output / `src/App.tsx` (route imports).

---

## Sign-Off

- [ ] All tests passed
- [ ] No critical issues
- [ ] No high-priority issues
- [ ] Ready for deployment

> ⚠ Pre-flight audit blockers: Issues **#1** and **#2** are 🔴 High and should be
> resolved (or explicitly accepted) before checking "Ready for deployment."

Date: ___________
Tester: ___________
