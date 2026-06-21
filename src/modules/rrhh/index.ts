/**
 * RRHH (Human Resources) module — public API.
 *
 * A read-only, BambooHR-backed HR module (directory, profiles, org chart, time-off,
 * departments) for Spectra Suite. Mounted at `/rrhh` in `src/App.tsx`. Everything
 * outside this module should import from here, not from deep paths inside the module.
 *
 * All BambooHR access in this module is READ-ONLY (see lib/connectors/bamboohr.ts).
 */
export { RrhhLayout } from './components/RrhhLayout'
export { default as Directory } from './pages/Directory'
export { default as Profile } from './pages/Profile'
export { default as OrgChart } from './pages/Org'
export { default as TimeOff } from './pages/TimeOff'
export { default as Departments } from './pages/Departments'
