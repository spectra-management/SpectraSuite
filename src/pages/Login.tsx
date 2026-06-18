import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { Loader2, Banknote, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useSettingsStore } from '@/store/settingsStore'
import { isSupabaseConfigured, signInWithGoogle } from '@/lib/supabase'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}

export default function Login() {
  const { t, i18n } = useTranslation()
  const { user, loading } = useAuth()
  const company = useSettingsStore((s) => s.company)
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en'

  useEffect(() => { document.title = `${t('auth.login.title')} | Spectra Suite` }, [t])

  // Already authenticated → straight to the suite.
  if (!loading && user) return <Navigate to="/suite" replace />

  const handleSignIn = async () => {
    setError(null)
    setSigningIn(true)
    // Shared helper (src/lib/supabase.ts): dynamic redirectTo (window origin) +
    // openid/email/profile + Calendar/Tasks scopes + access_type=offline & prompt=consent
    // so Google always returns a provider_token.
    const { error: oauthError } = await signInWithGoogle()
    if (oauthError) {
      setError(oauthError.message)
      setSigningIn(false)
    }
    // On success the browser redirects to Google; no further action needed.
  }

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Left — deep-emerald "security paper" brand panel (desktop only) */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-ink-grad p-12 lg:flex">
        <div className="absolute inset-0 bg-guilloche opacity-90" aria-hidden="true" />
        {/* Company logo on a light tile so it reads on the dark panel */}
        <div className="relative">
          {company.logoBase64 ? (
            <img
              src={company.logoBase64}
              alt={company.name}
              className="h-11 rounded-xl bg-white object-contain p-1.5 shadow-soft"
            />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-lg font-bold text-emerald-700 shadow-soft">
              {(company.name || 'S').charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="relative max-w-md animate-rise">
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-white">
            {t('auth.login.brandTagline')}
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-emerald-50/70">
            {t('auth.login.brandSub')}
          </p>
        </div>

        <p className="relative text-xs text-emerald-100/40">© Spectra Suite</p>
      </aside>

      {/* Right — sign-in */}
      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Language toggle, anchored top-right of the whole screen */}
        <div className="absolute right-6 top-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => i18n.changeLanguage(currentLang === 'en' ? 'es' : 'en')}
            className="font-semibold tracking-wide"
            aria-label="Toggle language"
          >
            {currentLang === 'en' ? 'ES' : 'EN'}
          </Button>
        </div>

        <div className="w-full max-w-sm animate-rise">
          <div className="flex flex-col items-center text-center">
            {company.logoBase64 ? (
              <img src={company.logoBase64} alt={company.name} className="h-20 w-auto object-contain" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-ink-grad text-emerald-50 shadow-soft">
                <Banknote className="h-8 w-8" strokeWidth={1.75} />
              </div>
            )}
            <h2 className="mt-6 text-2xl font-bold tracking-tight text-gray-900">{t('auth.login.welcome')}</h2>
            <p className="mt-1.5 text-sm text-gray-500">{t('auth.login.subtitle')}</p>
          </div>

          {!isSupabaseConfigured && (
            <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-700">
              {t('auth.login.notConfigured')}
            </p>
          )}

          <Button
            onClick={handleSignIn}
            disabled={signingIn || !isSupabaseConfigured}
            className="mt-8 w-full gap-2.5"
            size="lg"
          >
            {signingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon className="h-4 w-4" />}
            {t('auth.login.googleButton')}
          </Button>

          {error && <p className="mt-3 text-center text-xs text-red-600">{error}</p>}

          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-gray-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('auth.login.secured')}
          </div>
        </div>
      </main>
    </div>
  )
}
