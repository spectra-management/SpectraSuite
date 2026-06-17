// Spectra Suite module registry. The Nómina module is the existing payroll app;
// the others are placeholders with a Coming Soon screen.

export type SuiteModuleId = 'rrhh' | 'nomina' | 'facturacion' | 'gastos' | 'it'

export interface SuiteNavItem {
  icon: string        // emoji
  labelKey: string    // i18n key under suite.nav
}

export interface SuiteModule {
  id: SuiteModuleId
  icon: string   // emoji
  path: string
  active: boolean
  // Visual-only sidebar nav for placeholder modules (no routes behind them yet).
  navItems: SuiteNavItem[]
}

// Order matches the 2×2 suite grid: RRHH | Nómina / Facturación | Gastos.
export const SUITE_MODULES: SuiteModule[] = [
  {
    id: 'rrhh', icon: '🏢', path: '/rrhh', active: false,
    navItems: [
      { icon: '👥', labelKey: 'suite.nav.employees' },
      { icon: '🗂️', labelKey: 'suite.nav.departments' },
      { icon: '📋', labelKey: 'suite.nav.positions' },
      { icon: '📅', labelKey: 'suite.nav.attendance' },
      { icon: '📊', labelKey: 'suite.nav.reports' },
      { icon: '⚙️', labelKey: 'suite.nav.settings' },
    ],
  },
  { id: 'nomina', icon: '💵', path: '/nomina', active: true, navItems: [] },
  {
    id: 'facturacion', icon: '🧾', path: '/facturacion', active: false,
    navItems: [
      { icon: '🧾', labelKey: 'suite.nav.invoices' },
      { icon: '👤', labelKey: 'suite.nav.clients' },
      { icon: '📦', labelKey: 'suite.nav.products' },
      { icon: '💳', labelKey: 'suite.nav.payments' },
      { icon: '📊', labelKey: 'suite.nav.reports' },
      { icon: '⚙️', labelKey: 'suite.nav.settings' },
    ],
  },
  {
    id: 'gastos', icon: '💸', path: '/gastos', active: false,
    navItems: [
      { icon: '💸', labelKey: 'suite.nav.expenses' },
      { icon: '📂', labelKey: 'suite.nav.categories' },
      { icon: '🏢', labelKey: 'suite.nav.suppliers' },
      { icon: '✅', labelKey: 'suite.nav.approvals' },
      { icon: '📊', labelKey: 'suite.nav.reports' },
      { icon: '⚙️', labelKey: 'suite.nav.settings' },
    ],
  },
  {
    id: 'it', icon: '💻', path: '/it', active: false,
    navItems: [
      { icon: '💻', labelKey: 'suite.nav.assets' },
      { icon: '🖥️', labelKey: 'suite.nav.computers' },
      { icon: '🖨️', labelKey: 'suite.nav.peripherals' },
      { icon: '📱', labelKey: 'suite.nav.mobileDevices' },
      { icon: '🔑', labelKey: 'suite.nav.licenses' },
      { icon: '🔧', labelKey: 'suite.nav.maintenance' },
      { icon: '👤', labelKey: 'suite.nav.assignments' },
      { icon: '📊', labelKey: 'suite.nav.reports' },
      { icon: '⚙️', labelKey: 'suite.nav.settings' },
    ],
  },
]

export const getSuiteModule = (id: SuiteModuleId): SuiteModule =>
  SUITE_MODULES.find((m) => m.id === id)!
