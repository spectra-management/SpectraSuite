/**
 * Facturación (Billing/Invoicing) module — public API.
 *
 * Bills clients for staff labor using the hours/pay that the Payroll (nómina) module
 * FINALIZED, read ONLY through the shared accessor `@/shared/lib/payrollData` (this
 * module never imports nómina — see src/IMPORT_RULES.md). Mounted at `/facturacion`
 * in `src/App.tsx`. Everything outside this module should import from here.
 */
export { BillingLayout } from './components/BillingLayout'
export { default as BillingDashboard } from './pages/Dashboard'
export { default as Clients } from './pages/Clients'
export { default as ClientDetail } from './pages/ClientDetail'
export { default as Invoices } from './pages/Invoices'
export { default as NewInvoice } from './pages/NewInvoice'
export { default as InvoiceDetail } from './pages/InvoiceDetail'
export { default as BillingReports } from './pages/Reports'
