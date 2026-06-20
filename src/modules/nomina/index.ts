/**
 * Nómina (Payroll) module — public API.
 *
 * The existing Dominican Republic payroll app: BambooHR + Hubstaff connectors,
 * TSS/ISR calculation engine, paystub PDFs, and history. Mounted at `/nomina`
 * in `src/App.tsx`. Everything outside this module should import from here, not
 * from deep paths inside the module.
 */
export { default as Dashboard } from './pages/Dashboard'
export { default as Employees } from './pages/Employees'
export { default as EmployeeProfile } from './pages/Employees/EmployeeProfile'
export { default as Payroll } from './pages/Payroll'
export { default as History } from './pages/History'
export { default as Connectors } from './pages/Connectors'
export { default as Settings } from './pages/Settings'
