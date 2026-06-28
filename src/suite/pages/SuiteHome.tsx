import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Banknote, Plug, UserCircle, ArrowRight, Megaphone } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/components/ui/button'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useAuth } from '@/shared/context/AuthContext'
import { SUITE_MODULES } from '@/shared/lib/suiteModules'
import { useModuleVisibilityStore } from '@/shared/store/moduleVisibilityStore'
import { MODULE_ICONS } from '@/shared/components/moduleIcons'
import { UserMenu } from '@/shared/components/layout/UserMenu'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { Toaster } from '@/shared/components/ui/toaster'
import { ModuleSummaryCards } from './components/ModuleSummaryCards'
import { KpiStrip } from './components/KpiStrip'
import { NewsBoard } from './components/NewsBoard'
import { RewardsWidget } from './components/RewardsWidget'
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
  const { user, profile, hasModuleAccess, isSuperAdmin, isManager } = useAuth()
  const isModuleHidden = useModuleVisibilityStore((s) => s.isHidden)
  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en'

  useEffect(() => { document.title = 'Spectra Suite' }, [])

  const firstName = (profile?.full_name || user?.user_metadata?.full_name || user?.email || '')
    .toString()
    .split(' ')[0]

  return (
    <div className="min-h-screen bg-canvas">
      {/* Top bar */}
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-8">
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
            {isManager && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/suite/news')}
                className="gap-1.5"
                title={t('news.manageTitle')}
              >
                <Megaphone className="h-4 w-4" />
                <span className="hidden sm:inline">{t('news.navLabel')}</span>
              </Button>
            )}
            {isSuperAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/suite/connectors')}
                className="gap-1.5"
                title={t('connectors.title')}
              >
                <Plug className="h-4 w-4" />
                <span className="hidden sm:inline">{t('connectors.title')}</span>
              </Button>
            )}
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

      <main className="px-4 py-6 md:px-8 md:py-8">
        {/* Hero — ink "ledger" band with greeting + module launcher */}
        <section className="relative overflow-hidden rounded-2xl bg-ink-grad p-6 shadow-soft-lg animate-rise md:p-8">
          <div className="absolute inset-0 bg-guilloche opacity-90" aria-hidden="true" />
          <div className="relative">
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {t(`suiteHome.greeting.${greetingKey()}`, { name: firstName })}
            </h1>
            <p className="mt-1.5 text-sm text-emerald-50/70">{t('suite.subtitle')}</p>

            <div className="mt-7 flex flex-wrap gap-2.5">
              {SUITE_MODULES.filter((m) => hasModuleAccess(m.id) && !isModuleHidden(m.id)).map((m) => {
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

        {isManager ? (
          <>
            {/* KPI strip — fast read of the business */}
            <div className="mt-8 animate-rise">
              <KpiStrip />
            </div>

            {/* Overview (wide) + compact Tasks / Upcoming column */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 animate-rise-2">
                <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {t('suiteHome.overview')}
                </h2>
                <ModuleSummaryCards />
              </div>

              <div className="space-y-6 animate-rise-3">
                <TasksWidget />
                <CalendarWidget />
              </div>
            </div>

            {/* Recent Emails — full-width inbox strip */}
            <div className="mt-6 animate-rise-3">
              <EmailsWidget />
            </div>
          </>
        ) : (
          /* Normal users: profile shortcut + daily rewards + the news board. */
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-6 animate-rise">
              <button
                type="button"
                onClick={() => navigate('/me')}
                className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                  <UserCircle className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{t('selfProfile.cardTitle')}</span>
                  <span className="block text-xs text-muted-foreground">{t('selfProfile.cardHint')}</span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
              </button>
              <RewardsWidget />
            </div>
            <div className="animate-rise-2">
              <NewsBoard />
            </div>
          </div>
        )}
      </main>
      <Toaster />
    </div>
  )
}
