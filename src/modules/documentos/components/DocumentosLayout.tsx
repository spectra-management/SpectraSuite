import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Header } from '@/shared/components/layout/Header'
import { Toaster } from '@/shared/components/ui/toaster'
import { DocumentosSidebar } from './DocumentosSidebar'
import { useDocumentsStore } from '../store/documentsStore'

/**
 * Documentos module shell. Same structure as the Nómina / RRHH / Billing layouts
 * (shared Header, mobile drawer, scrollable main, toaster) with the documents sidebar.
 *
 * On mount it seeds the built-in templates once per workspace and reads templates +
 * generated records back from the cloud (best-effort, offline-safe, cloud-authoritative).
 */
export function DocumentosLayout() {
  const { t } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const initialize = useDocumentsStore((s) => s.initialize)

  useEffect(() => {
    document.title = `${t('suite.modules.documentos')} | Spectra Suite`
  }, [t])

  useEffect(() => {
    void initialize()
  }, [initialize])

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <DocumentosSidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
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
