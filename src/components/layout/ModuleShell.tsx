import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Toaster } from '@/components/ui/toaster'
import { useSettingsStore } from '@/store/settingsStore'
import { getSuiteModule, type SuiteModuleId } from '@/lib/suiteModules'
import { MODULE_ICONS } from '@/components/moduleIcons'
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { SidebarToggle } from './SidebarToggle'

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
  const { collapsed, toggle } = useSidebarCollapsed()

  useEffect(() => { document.title = `${name} | Spectra Suite` }, [name])

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      {/* Module sidebar */}
      <aside
        className={cn(
          'flex h-full flex-col border-r border-border bg-card transition-[width] duration-200 ease-in-out',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <div
          className={cn(
            'border-b border-border',
            collapsed ? 'flex flex-col items-center gap-2 px-2 py-3' : 'flex items-center justify-between gap-2 px-4 py-3',
          )}
        >
          <Link
            to="/suite"
            title={collapsed ? t('suite.back') : undefined}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {!collapsed && t('suite.back')}
          </Link>
          <SidebarToggle collapsed={collapsed} onToggle={toggle} />
        </div>
        <div
          className={cn(
            'flex items-center border-b border-border',
            collapsed ? 'justify-center px-2 py-4' : 'gap-2.5 px-6 py-4',
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Icon className="h-4 w-4" />
          </span>
          {!collapsed && <span className="text-sm font-bold uppercase tracking-wide text-foreground">{name}</span>}
        </div>
        {/* Visual-only nav — no routes behind these yet */}
        <nav className="flex-1 space-y-1 overflow-auto p-3">
          {mod.navItems.map((item) => (
            <button
              key={item.labelKey}
              type="button"
              disabled
              title={collapsed ? t(item.labelKey) : undefined}
              className={cn(
                'flex w-full cursor-default items-center rounded-lg py-2 text-sm font-medium text-muted-foreground/70',
                collapsed ? 'justify-center px-0' : 'gap-3 px-3',
              )}
            >
              <span className="w-4 text-center text-sm leading-none">{item.icon}</span>
              {!collapsed && t(item.labelKey)}
            </button>
          ))}
        </nav>
        {/* Company footer (inherited from suite-level settings) */}
        <div
          className={cn(
            'flex items-center border-t border-border',
            collapsed ? 'justify-center p-3' : 'gap-2 p-4',
          )}
        >
          {company.logoBase64 ? (
            <img src={company.logoBase64} alt="logo" className="h-6 w-6 shrink-0 rounded-md object-contain" title={collapsed ? company.name : undefined} />
          ) : (
            <div
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-[10px] font-bold text-white"
              title={collapsed ? company.name : undefined}
            >
              {company.name.charAt(0).toUpperCase()}
            </div>
          )}
          {!collapsed && <p className="truncate text-xs font-medium text-foreground">{company.name}</p>}
        </div>
      </aside>

      {/* Coming Soon content */}
      <main className="relative flex flex-1 flex-col items-center justify-center gap-4 overflow-auto p-6 text-center">
        {/* Language + theme toggles, top-right of the content area (matches Nómina) */}
        <div className="absolute right-6 top-6 z-10 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="font-semibold tracking-wide"
            onClick={() => i18n.changeLanguage(currentLang === 'en' ? 'es' : 'en')}
            aria-label="Toggle language"
          >
            {currentLang === 'en' ? 'ES' : 'EN'}
          </Button>
          <ThemeToggle />
        </div>

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
