/**
 * Targeted auth/session cleanup for the inactivity-timeout path.
 *
 * Previously the inactivity timeout called the NATIVE `localStorage.clear()`, which
 * wiped EVERYTHING for the origin — including business-data caches (employees,
 * payroll history, settings, connectors). Now that business data is cloud-authoritative
 * and re-hydrated on the next login, the timeout only needs to drop AUTH/SESSION state:
 *
 *   - Google OAuth provider tokens (`google_provider_token`, `google_provider_refresh_token`)
 *   - Supabase's own session keys (prefixed `sb-`) — `supabase.auth.signOut()` already
 *     clears these; we also sweep them defensively.
 *
 * Everything else (all `spectra_`-prefixed business caches, theme, sidebar state) is
 * PRESERVED, so a timeout no longer destroys local data; the cloud read-back restores
 * the durable copy on next login regardless.
 */

export const AUTH_LOCAL_KEYS = [
  'google_provider_token',
  'google_provider_refresh_token',
] as const

/**
 * Remove only auth/session keys from localStorage, preserving all business data.
 * Operates on the global `localStorage` (jsdom provides it under test).
 */
export function clearAuthSessionKeys(): void {
  try {
    for (const key of AUTH_LOCAL_KEYS) localStorage.removeItem(key)
    // Supabase persists its session under `sb-<ref>-auth-token` keys. Enumerate via the
    // Storage API (Object.keys does not reliably list Storage items) into a snapshot
    // first, then remove (removing while indexing would shift positions).
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-')) toRemove.push(key)
    }
    for (const key of toRemove) localStorage.removeItem(key)
  } catch {
    /* ignore — best-effort cleanup */
  }
}
