import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Toaster } from '@/components/ui/toaster'
import { useSettingsStore } from '@/store/settingsStore'
import { getSuiteModule, type SuiteModuleId } from '@/lib/suiteModules'
import { MODULE_ICONS } from '@/components/moduleIcons'

/**
 * Two-panel shell for a placeholder Suite module (RRHH, Facturación, Gastos, IT):
 * a module-specific sidebar (back button + language toggle + module header + visual-only
 * nav + company footer) and a Coming Soon content area. Company info is read from the
 * shared suite-level settings store. The Nómina module uses its own Layout/Sidebar.
 */
export function ModuleShell({ moduleId }: { moduleId: SuiteModuleId }) {
  const { t, i18n } = useTranslation()
  const company = useSettingsStore((s) => s.company)
  const mod = getSuiteModule(moduleId)
  const Icon = MODULE_ICONS[moduleId]
  const name = t(`suite.modules.${moduleId}`)
  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en'

  useEffect(() => { document.title = `${name} | Spectra Suite` }, [name])

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Module sidebar */}
      <aside className="flex h-full w-60 flex-col border-r border-border bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <Link to="/suite" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400">
            <ArrowLeft className="h-3.5 w-3.5" /> {t('suite.back')}
          </Link>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs font-semibold tracking-wide"
              onClick={() => i18n.changeLanguage(currentLang === 'en' ? 'es' : 'en')}
              aria-label="Toggle language"
            >
              {currentLang === 'en' ? 'ES' : 'EN'}
            </Button>
            <ThemeToggle className="h-7 w-7" />
          </div>
        </div>
        <div className="flex items-center gap-2.5 border-b border-border px-6 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold uppercase tracking-wide text-foreground">{name}</span>
        </div>
        {/* Visual-only nav — no routes behind these yet */}
        <nav className="flex-1 space-y-1 overflow-auto p-3">
          {mod.navItems.map((item) => (
            <button
              key={item.labelKey}
              type="button"
              disabled
              className="flex w-full cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/70"
            >
              <span className="w-4 text-center text-sm leading-none">{item.icon}</span>
              {t(item.labelKey)}
            </button>
          ))}
        </nav>
        {/* Company footer (inherited from suite-level settings) */}
        <div className="flex items-center gap-2 border-t border-border p-4">
          {company.logoBase64 ? (
            <img src={company.logoBase64} alt="logo" className="h-6 w-6 rounded-md object-contain" />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-[10px] font-bold text-white">
              {company.name.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="truncate text-xs font-medium text-foreground">{company.name}</p>
        </div>
      </aside>

      {/* Coming Soon content */}
      <main className="flex flex-1 flex-col items-center justify-center gap-4 overflow-auto p-6 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-ink-grad text-emerald-50 shadow-soft-lg">
          <Icon className="h-9 w-9" strokeWidth={1.5} />
        </span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{name}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{t('suite.underDevelopment')}</p>
        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
          {t('suite.comingSoon')}
        </span>
        <Button variant="outline" asChild className="mt-2">
          <Link to="/suite">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> {t('suite.backToSuite')}
          </Link>
        </Button>
      </main>
      <Toaster />
    </div>
  )
}
