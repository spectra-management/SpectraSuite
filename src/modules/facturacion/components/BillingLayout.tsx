import { useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Header } from '@/shared/components/layout/Header'
import { Toaster } from '@/shared/components/ui/toaster'
import { useEmployeesStore } from '@/shared/store/employeesStore'
import { useEmployeeHrStore } from '@/shared/store/employeeHrStore'
import { useBillingStore } from '@/modules/facturacion/store/billingStore'
import { BillingSidebar } from './BillingSidebar'

/**
 * Billing (facturación) module shell. Same structure as the Nómina / RRHH layouts
 * (shared Header, mobile drawer, scrollable main, toaster) with the billing sidebar.
 */
export function BillingLayout() {
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    document.title = `${t('suite.modules.facturacion')} | Spectra Suite`
  }, [t])

  // BambooHR division = client: auto-create a client per division and auto-assign each
  // employee to it (idempotent). Runs once when entering the billing module so every page
  // (clients, detail, new invoice) sees consistent assignments.
  const employees = useEmployeesStore((s) => s.employees)
  const hrById = useEmployeeHrStore((s) => s.byId)
  const ensureClientsForDivisions = useBillingStore((s) => s.ensureClientsForDivisions)
  const ensureAssignmentsForDivisions = useBillingStore((s) => s.ensureAssignmentsForDivisions)
  const roster = useMemo(
    () => employees.map((e) => ({ id: e.id, division: hrById[e.id]?.division ?? '' })),
    [employees, hrById],
  )
  useEffect(() => {
    const divisions = [...new Set(roster.map((r) => (r.division ?? '').trim()).filter(Boolean))]
    if (divisions.length === 0) return
    ensureClientsForDivisions(divisions)
    ensureAssignmentsForDivisions(roster)
  }, [roster, ensureClientsForDivisions, ensureAssignmentsForDivisions])

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <BillingSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  )
}
