import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Header } from '@/shared/components/layout/Header'
import { Toaster } from '@/shared/components/ui/toaster'
import { RrhhSidebar } from './RrhhSidebar'

/**
 * RRHH module shell. Identical structure to the Nómina `Layout` (shared `Header`,
 * mobile drawer, scrollable main, toaster) with the RRHH sidebar.
 */
export function RrhhLayout() {
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    document.title = `${t('suite.modules.rrhh')} | Spectra Suite`
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
      <RrhhSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
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
