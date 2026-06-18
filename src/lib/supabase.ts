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
