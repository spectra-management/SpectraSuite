import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/store/settingsStore'
import { SUITE_MODULES } from '@/lib/suiteModules'
import { Toaster } from '@/components/ui/toaster'

export default function SuiteHome() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const company = useSettingsStore((s) => s.company)
  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en'

  useEffect(() => { document.title = 'Spectra Suite' }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-4">
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
            <Button variant="outline" size="icon" aria-label={t('suite.settings.title')} asChild>
              <Link to="/suite/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Module cards — all clickable */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="mb-6 text-center text-sm text-gray-500">{t('suite.subtitle')}</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SUITE_MODULES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate(m.path)}
              className={cn(
                'group flex cursor-pointer flex-col items-start gap-3 rounded-2xl border p-6 text-left transition-all hover:shadow-md',
                m.active
                  ? 'border-emerald-200 bg-white hover:border-emerald-400'
                  : 'border-gray-200 bg-white opacity-90 hover:border-gray-300 hover:opacity-100',
              )}
            >
              <span className="text-3xl leading-none">{m.icon}</span>
              <span className="text-base font-semibold text-gray-900">{t(`suite.modules.${m.id}`)}</span>
              {m.active ? (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600">
                  {t('suite.active')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                  {t('suite.inDevelopment')}
                </span>
              )}
            </button>
          ))}
        </div>
      </main>
      <Toaster />
    </div>
  )
}
