import { test, expect } from '@playwright/test'
import { screenshot } from './helpers'

/**
 * Full-system visual tour: visit every main screen, capture a screenshot for review, and
 * fail if a screen throws an uncaught error or leaves #root empty (blank/broken render).
 *
 * Auth is bypassed when no VITE_SUPABASE_* env is set, so every route is reachable. Data-
 * driven screens render their empty/not-connected states (expected without a synced DB).
 */
const ROUTES: { name: string; path: string }[] = [
  { name: '01-suite-home', path: '/suite' },
  { name: '02-my-profile', path: '/me' },
  { name: '03-calendar', path: '/calendar' },
  { name: '04-news-manage', path: '/suite/news' },
  { name: '05-suite-settings', path: '/suite/settings' },
  { name: '06-nomina-dashboard', path: '/nomina/dashboard' },
  { name: '07-nomina-employees', path: '/nomina/employees' },
  { name: '08-nomina-payroll', path: '/nomina/payroll' },
  { name: '09-nomina-history', path: '/nomina/history' },
  { name: '10-nomina-settings', path: '/nomina/settings' },
  { name: '11-rrhh-directory', path: '/rrhh/directory' },
  { name: '12-rrhh-org', path: '/rrhh/org' },
  { name: '13-rrhh-timeoff', path: '/rrhh/time-off' },
  { name: '14-rrhh-departments', path: '/rrhh/departments' },
  { name: '15-facturacion-dashboard', path: '/facturacion/dashboard' },
  { name: '16-facturacion-clients', path: '/facturacion/clients' },
  { name: '17-facturacion-invoices', path: '/facturacion/invoices' },
  { name: '18-facturacion-reports', path: '/facturacion/reports' },
  { name: '19-documentos-generate', path: '/documentos/generate' },
  { name: '20-documentos-templates', path: '/documentos/templates' },
  { name: '21-documentos-history', path: '/documentos/history' },
  { name: '22-tablero-boards', path: '/tablero/boards' },
]

for (const route of ROUTES) {
  test(`renders ${route.name} (${route.path})`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await page.goto(route.path)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(400) // let entrance animations settle

    await expect(page.locator('#root'), `${route.path} left #root empty`).not.toBeEmpty()
    await screenshot(page, route.name)

    expect(errors, `Uncaught errors on ${route.path}:\n${errors.join('\n')}`).toEqual([])
  })
}
