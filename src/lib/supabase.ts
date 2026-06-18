import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/**
 * Whether the Supabase environment is configured. When false (env vars missing
 * in a local/offline build), the app degrades gracefully: auth screens show a
 * config notice and data layers fall back to localStorage.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey)

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set. ' +
      'Auth and cloud persistence are disabled; falling back to localStorage.',
  )
}

// Untyped client: query results are cast to the Row types in src/types/supabase.ts
// at each call site. (Wiring the hand-written Database generic into createClient
// makes this supabase-js version resolve table rows to `never`.)
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseKey ?? 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

/**
 * Single source of truth for the post-login OAuth/invite redirect target.
 *
 * ALWAYS derived from the live browser origin — NEVER a hardcoded host or env
 * var — so it resolves correctly everywhere:
 *   - Production: https://spectra-suite.vercel.app/suite
 *   - Local dev:  http://localhost:3000/suite (requires a local server running)
 *
 * ⚠️ IMPORTANT — the remaining cause of "redirected to localhost:3000" is NOT in
 * this code. Supabase only honors `redirectTo` if the URL is in the Dashboard
 * allowlist. If it isn't, Supabase ignores it and falls back to the Site URL.
 * So in Supabase Dashboard → Authentication → URL Configuration set:
 *   - Site URL:      https://spectra-suite.vercel.app   (NOT localhost)
 *   - Redirect URLs: https://spectra-suite.vercel.app/suite   (add localhost:3000/suite for dev)
 */
export function authRedirectTo(path = '/suite'): string {
  return `${window.location.origin}${path}`
}

/**
 * Google OAuth scopes. `openid email profile` cover the basic identity; the two
 * Google API scopes grant the Suite Dashboard read/write to Tasks and read to
 * Calendar.
 *
 * These APIs must ALSO be enabled in Google Cloud Console for the OAuth client,
 * or the provider_token is rejected with 403:
 *   - Google Calendar API: https://console.cloud.google.com/apis/library/calendar-json.googleapis.com
 *   - Google Tasks API:    https://console.cloud.google.com/apis/library/tasks.googleapis.com
 */
export const GOOGLE_OAUTH_SCOPES =
  'openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks'

/**
 * Start Google OAuth. `access_type: offline` + `prompt: consent` force Google to
 * return a provider_token (and a provider_refresh_token) every time, so the
 * dashboard always gets a usable token after sign-in / reconnect.
 */
export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: authRedirectTo('/suite'),
      scopes: GOOGLE_OAUTH_SCOPES,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  })
}
