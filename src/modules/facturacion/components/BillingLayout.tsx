import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Header } from '@/shared/components/layout/Header'
import { Toaster } from '@/shared/components/ui/toaster'
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
