/**
 * Spectra Suite shell — public API.
 *
 * The cross-module landing surface: the suite home (module launcher), the
 * super-admin suite settings, and the suite-level connectors (integrations
 * shared across modules). Mounted at `/suite` in `src/App.tsx`.
 */
export { default as SuiteHome } from './pages/SuiteHome'
export { default as SuiteSettings } from './pages/SuiteSettings'
export { default as SuiteConnectors } from './pages/SuiteConnectors'
