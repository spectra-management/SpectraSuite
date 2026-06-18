import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/store/settingsStore'
import { useAuth } from '@/contexts/AuthContext'
import { SUITE_MODULES } from '@/lib/suiteModules'
import { UserMenu } from '@/components/layout/UserMenu'
import { Toaster } from '@/components/ui/toaster'
import { ModuleSummaryCards } from './components/ModuleSummaryCards'
import { TasksWidget } from './components/TasksWidget'
import { CalendarWidget } from './components/CalendarWidget'

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
  const { user, profile } = useAuth()
  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en'

  useEffect(() => { document.title = 'Spectra Suite' }, [])

  const firstName = (profile?.full_name || user?.user_metadata?.full_name || user?.email || '')
    .toString()
    .split(' ')[0]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            {company.logoBase64 ? (
              <img src={company.logoBase64} alt="logo" className="h-9 w-9 rounded-lg object-contain" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
                S
              </div>
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-900">{t('suite.title')}</h1>
              <p className="text-xs text-gray-500">{company.name}</p>
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
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Greeting */}
        <h2 className="text-2xl font-bold text-gray-900">
          {t(`suiteHome.greeting.${greetingKey()}`, { name: firstName })}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{t('suite.subtitle')}</p>

        {/* Module cards row — compact, horizontal */}
        <div className="mt-6 flex flex-wrap gap-3">
          {SUITE_MODULES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate(m.path)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all hover:shadow-sm',
                m.active
                  ? 'border-emerald-200 bg-white text-gray-900 hover:border-emerald-400'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
              )}
            >
              <span className="text-lg leading-none">{m.icon}</span>
              {t(`suite.modules.${m.id}`)}
            </button>
          ))}
        </div>

        {/* 3-column dashboard grid */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left — module summaries */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
              {t('suiteHome.overview')}
            </h3>
            <ModuleSummaryCards />
          </div>

          {/* Center — tasks */}
          <div className="min-h-[20rem]">
            <TasksWidget />
          </div>

          {/* Right — calendar */}
          <div className="min-h-[20rem]">
            <CalendarWidget />
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  )
}
