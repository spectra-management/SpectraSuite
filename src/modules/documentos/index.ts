/**
 * Documentos (Company Documents) module — public API.
 *
 * Generate company documents (contracts, work letters, NDAs, HR notices) by picking a
 * template and one or more employees; data auto-fills from HR (BambooHR via the shared
 * @/shared/connectors/bamboohr-hr connector) and exports to PDF. Mounted at `/documentos`
 * in `src/App.tsx`. Everything outside this module should import from here, not from deep
 * paths inside the module.
 */
export { DocumentosLayout } from './components/DocumentosLayout'
export { default as DocumentosGenerate } from './pages/Generate'
export { default as DocumentosTemplates } from './pages/Templates'
export { default as DocumentosHistory } from './pages/History'
