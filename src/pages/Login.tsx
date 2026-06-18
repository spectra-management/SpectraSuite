import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useSettingsStore } from '@/store/settingsStore'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'

// Google OAuth scopes — the basic profile/email scopes are implicit; these extra
// scopes grant the Suite Dashboard read access to Google Tasks + Calendar.
// NOTE: enable "Google Tasks API" and "Google Calendar API" in Google Cloud Console
// for the same OAuth client, otherwise the provider_token will be rejected by those APIs.
const GOOGLE_SCOPES =
  'https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/calendar.readonly'

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
    // IMPORTANT: redirectTo must be derived from the CURRENT window origin, never a
    // hardcoded host — otherwise production sign-ins bounce back to localhost.
    // Using `${window.location.origin}/suite` means:
    //   - In production it resolves to https://spectra-suite.vercel.app/suite
    //   - When running locally it resolves to http://localhost:3000/suite (or whatever
    //     port the dev server uses), which requires a local server to be running to
    //     receive the redirect.
    // Supabase also enforces an allowlist: Dashboard → Authentication → URL Configuration
    //   - Site URL:       https://spectra-suite.vercel.app
    //   - Redirect URLs:  https://spectra-suite.vercel.app/suite  (add localhost too for dev)
    // A redirectTo that isn't in that allowlist is ignored and Supabase falls back to the
    // Site URL — which is the usual cause of the "redirected to localhost" symptom.
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/suite`,
        scopes: GOOGLE_SCOPES,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (oauthError) {
      setError(oauthError.message)
      setSigningIn(false)
    }
    // On success the browser redirects to Google; no further action needed.
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Language toggle */}
      <div className="flex justify-end p-6">
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

      {/* Centered card */}
      <div className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            {company.logoBase64 ? (
              <img src={company.logoBase64} alt="logo" className="h-16 w-16 rounded-2xl object-contain" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-bold text-white">
                S
              </div>
            )}
            <h1 className="mt-5 text-xl font-bold text-gray-900">{t('auth.login.welcome')}</h1>
            <p className="mt-1 text-sm text-gray-500">{t('auth.login.subtitle')}</p>

            {!isSupabaseConfigured && (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                {t('auth.login.notConfigured')}
              </p>
            )}

            <Button
              onClick={handleSignIn}
              disabled={signingIn || !isSupabaseConfigured}
              className="mt-6 w-full gap-2"
              size="lg"
            >
              {signingIn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon className="h-4 w-4" />
              )}
              {t('auth.login.googleButton')}
            </Button>

            {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
