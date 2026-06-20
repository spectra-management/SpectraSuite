import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Banknote } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/components/ui/button'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useAuth } from '@/shared/context/AuthContext'
import { SUITE_MODULES } from '@/shared/lib/suiteModules'
import { MODULE_ICONS } from '@/shared/components/moduleIcons'
import { UserMenu } from '@/shared/components/layout/UserMenu'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { Toaster } from '@/shared/components/ui/toaster'
import { ModuleSummaryCards } from './components/ModuleSummaryCards'
import { TasksWidget } from './components/TasksWidget'
import { CalendarWidget } from './components/CalendarWidget'
import { EmailsWidget } from './components/EmailsWidget'

function greetingKey(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

export default function SuiteHome() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const company = useSettingsStore((s) => s.company)
  const { user, profile, hasModuleAccess } = useAuth()
  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en'

  useEffect(() => { document.title = 'Spectra Suite' }, [])

  const firstName = (profile?.full_name || user?.user_metadata?.full_name || user?.email || '')
    .toString()
    .split(' ')[0]

  return (
    <div className="min-h-screen bg-canvas">
      {/* Top bar */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div className="flex items-center gap-2.5">
            {company.logoBase64 ? (
              <img src={company.logoBase64} alt="logo" className="h-9 w-9 rounded-xl object-contain" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-grad text-emerald-50">
                <Banknote className="h-5 w-5" strokeWidth={1.75} />
              </div>
            )}
            <div className="leading-tight">
              <span className="block text-base font-bold tracking-tight text-foreground">
                Spectra <span className="text-emerald-600 dark:text-emerald-400">Suite</span>
              </span>
              <span className="block text-xs text-muted-foreground">{company.name}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => i18n.changeLanguage(currentLang === 'en' ? 'es' : 'en')}
              className="font-semibold tracking-wide"
              aria-label="Toggle language"
            >
              {currentLang === 'en' ? 'ES' : 'EN'}
            </Button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
        {/* Hero — ink "ledger" band with greeting + module launcher */}
        <section className="relative overflow-hidden rounded-2xl bg-ink-grad p-6 shadow-soft-lg animate-rise md:p-8">
          <div className="absolute inset-0 bg-guilloche opacity-90" aria-hidden="true" />
          <div className="relative">
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {t(`suiteHome.greeting.${greetingKey()}`, { name: firstName })}
            </h1>
            <p className="mt-1.5 text-sm text-emerald-50/70">{t('suite.subtitle')}</p>

            <div className="mt-7 flex flex-wrap gap-2.5">
              {SUITE_MODULES.filter((m) => hasModuleAccess(m.id)).map((m) => {
                const Icon = MODULE_ICONS[m.id]
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => navigate(m.path)}
                    className={cn(
                      'group inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium backdrop-blur-sm transition-all',
                      m.active
                        ? 'border-white/15 bg-white/10 text-white hover:bg-white/20'
                        : 'border-white/10 bg-white/[0.04] text-emerald-50/60 hover:bg-white/10 hover:text-emerald-50/90',
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    {t(`suite.modules.${m.id}`)}
                    {m.active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        </section>

        {/* 3-column dashboard grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="animate-rise">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t('suiteHome.overview')}
            </h2>
            <ModuleSummaryCards />
          </div>

          <div className="min-h-[20rem] animate-rise-2">
            <TasksWidget />
          </div>

          <div className="min-h-[20rem] animate-rise-3">
            <CalendarWidget />
          </div>
        </div>

        {/* Recent Emails — full-width inbox strip */}
        <div className="mt-6 animate-rise-3">
          <EmailsWidget />
        </div>
      </main>
      <Toaster />
    </div>
  )
}
