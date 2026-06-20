import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured, signInWithGoogle } from '@/lib/supabase'
import { useSettingsStore } from '@/store/settingsStore'
import { logAuditEvent } from '@/lib/audit'
import { SessionTimeoutModal } from '@/components/SessionTimeoutModal'
import type { ProfileRow, ModulePermissionRow, ModuleId } from '@/types/supabase'

const DEFAULT_TIMEOUT_MIN = 480
const MIN_TIMEOUT_MIN = 5
const MAX_TIMEOUT_MIN = 1440
const clampTimeout = (m: number) => Math.min(MAX_TIMEOUT_MIN, Math.max(MIN_TIMEOUT_MIN, Math.round(m)))

// Supabase only returns the Google provider_token on the INITIAL sign-in event,
// not from getSession() after a reload. So we cache it (and the refresh token) in
// localStorage on SIGNED_IN and fall back to it when a later session has none.
// (Best-effort: the access token can still expire, hence the "Reconnect Google"
// path in the dashboard widgets.)
const GOOGLE_TOKEN_KEY = 'google_provider_token'
const GOOGLE_REFRESH_KEY = 'google_provider_refresh_token'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  permissions: ModulePermissionRow[]
  loading: boolean
  isSuperAdmin: boolean
  googleProviderToken: string | null
  hasModuleAccess: (module: ModuleId) => boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  /** Re-run Google OAuth (with Calendar/Tasks scopes) to obtain a fresh provider_token. */
  reconnectGoogle: () => Promise<void>
  /** Inactivity timeout in minutes (super-admin configurable). */
  sessionTimeoutMinutes: number
  /** Apply a new timeout live (called by Suite Settings after saving). */
  setSessionTimeoutMinutes: (m: number) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [permissions, setPermissions] = useState<ModulePermissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [googleProviderToken, setGoogleProviderToken] = useState<string | null>(
    () => localStorage.getItem(GOOGLE_TOKEN_KEY),
  )
  const [sessionTimeoutMinutes, setSessionTimeoutMinutesState] = useState(DEFAULT_TIMEOUT_MIN)
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)
  const [warningRemainingMs, setWarningRemainingMs] = useState(0)

  const loadProfile = useCallback(async (uid: string) => {
    const fetchRow = () =>
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle()

    const { data: firstFetch, error } = await fetchRow()
    console.log('[auth] profile fetch →', { uid, profile: firstFetch, error: error?.message })
    if (error) {
      // A recursion error here ("infinite recursion detected in policy for
      // relation profiles") means the RLS policies need migration 003.
      console.error('[auth] failed to load profile:', error.message)
      setProfile(null)
      setPermissions([])
      return
    }

    let profileData = firstFetch
    // First-user bootstrap: if we're not already a super_admin, ask the DB to
    // promote us — but the SECURITY DEFINER function `claim_super_admin_if_first`
    // only does so when WE are the very first user AND no super_admin exists yet.
    // It no-ops otherwise, so this is safe to call on every non-admin login.
    // (A client-side UPDATE can't do this: profiles RLS only lets super_admins
    // modify profiles, so the first viewer could never promote itself.)
    if (profileData && profileData.role !== 'super_admin') {
      const { error: rpcErr } = await supabase.rpc('claim_super_admin_if_first')
      if (!rpcErr) {
        const { data: refreshed } = await fetchRow()
        if (refreshed) profileData = refreshed
      } else {
        console.warn('[auth] claim_super_admin_if_first unavailable:', rpcErr.message)
      }
    }
    setProfile(profileData ?? null)

    const { data: permData, error: permError } = await supabase
      .from('user_module_permissions')
      .select('*')
      .eq('user_id', uid)
    console.log('[auth] permissions fetch →', { uid, permissions: permData, error: permError?.message })
    if (permError) {
      console.error('[auth] failed to load permissions:', permError.message)
      setPermissions([])
    } else {
      setPermissions(permData ?? [])
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user?.id) await loadProfile(user.id)
  }, [user?.id, loadProfile])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }

    let active = true

    const applySession = async (s: Session | null, event?: AuthChangeEvent) => {
      if (!active) return
      console.log('[auth] session →', {
        hasSession: !!s,
        userId: s?.user?.id,
        email: s?.user?.email,
        hasProviderToken: !!s?.provider_token,
      })
      setSession(s)
      setUser(s?.user ?? null)
      // provider_token (+ refresh token) only arrive on fresh OAuth — persist them
      // so they survive reloads. If this session has none, keep using the cached one.
      if (s?.provider_token) {
        localStorage.setItem(GOOGLE_TOKEN_KEY, s.provider_token)
        setGoogleProviderToken(s.provider_token)
      } else {
        const cached = localStorage.getItem(GOOGLE_TOKEN_KEY)
        if (cached) setGoogleProviderToken(cached)
      }
      if (s?.provider_refresh_token) {
        localStorage.setItem(GOOGLE_REFRESH_KEY, s.provider_refresh_token)
      }
      console.log('[auth] google provider_token →', {
        fromSession: !!s?.provider_token,
        fromCache: !s?.provider_token && !!localStorage.getItem(GOOGLE_TOKEN_KEY),
      })
      if (s?.user) {
        await loadProfile(s.user.id)
        // Cloud is authoritative for company settings once signed in.
        void useSettingsStore.getState().hydrateCompanyFromCloud()
        // Load the configured inactivity timeout (company_settings is publicly readable).
        void supabase
          .from('company_settings')
          .select('session_timeout_minutes')
          .limit(1)
          .maybeSingle()
          .then(({ data }) => {
            if (active && data?.session_timeout_minutes) {
              setSessionTimeoutMinutesState(clampTimeout(data.session_timeout_minutes))
            }
          })
        // Audit the login (only on the actual sign-in event, not token refreshes).
        if (event === 'SIGNED_IN') {
          void logAuditEvent({ action: 'login', category: 'auth', details: { email: s.user.email } })
        }
      } else {
        setProfile(null)
        setPermissions([])
      }
      if (active) setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => applySession(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      void applySession(s, event)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await logAuditEvent({ action: 'logout', category: 'auth' })
    await supabase.auth.signOut()
    localStorage.removeItem(GOOGLE_TOKEN_KEY)
    localStorage.removeItem(GOOGLE_REFRESH_KEY)
    setGoogleProviderToken(null)
    setSession(null)
    setUser(null)
    setProfile(null)
    setPermissions([])
    window.location.assign('/login')
  }, [])

  // Auto-logout on inactivity timeout.
  const handleSessionExpired = useCallback(async () => {
    await logAuditEvent({ action: 'session_expired', category: 'auth', details: { reason: 'inactivity' } })
    await supabase.auth.signOut()
    localStorage.clear()
    window.location.href = '/login'
  }, [])

  // "Stay Logged In": refresh the token and reset the inactivity clock.
  const lastActivityRef = useRef(Date.now())
  const warningShownRef = useRef(false)
  const extendSession = useCallback(async () => {
    try { await supabase.auth.refreshSession() } catch { /* ignore */ }
    lastActivityRef.current = Date.now()
    warningShownRef.current = false
    setShowTimeoutWarning(false)
  }, [])

  const setSessionTimeoutMinutes = useCallback((m: number) => {
    setSessionTimeoutMinutesState(clampTimeout(m))
    lastActivityRef.current = Date.now()
  }, [])

  // Inactivity tracking: warn at 95% of the timeout, auto-logout at 100%.
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return
    const timeoutMs = clampTimeout(sessionTimeoutMinutes) * 60_000
    const warnAtMs = timeoutMs * 0.95
    lastActivityRef.current = Date.now()
    warningShownRef.current = false

    // Activity resets the clock — but ignored while the warning is up (the user
    // must explicitly choose Stay Logged In / Logout there).
    const onActivity = () => { if (!warningShownRef.current) lastActivityRef.current = Date.now() }
    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current
      if (elapsed >= timeoutMs) {
        clearInterval(interval)
        void handleSessionExpired()
      } else if (elapsed >= warnAtMs) {
        warningShownRef.current = true
        setShowTimeoutWarning(true)
        setWarningRemainingMs(timeoutMs - elapsed)
      } else if (warningShownRef.current) {
        warningShownRef.current = false
        setShowTimeoutWarning(false)
      }
    }, 1000)

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity))
      clearInterval(interval)
    }
  }, [user, sessionTimeoutMinutes, handleSessionExpired])

  const reconnectGoogle = useCallback(async () => {
    // Force a fresh consent so Google returns a new provider_token with the
    // Calendar/Tasks scopes; the SIGNED_IN handler re-caches it on return.
    await signInWithGoogle(true)
  }, [])

  const isSuperAdmin = profile?.role === 'super_admin'

  const hasModuleAccess = useCallback(
    (module: ModuleId): boolean => {
      if (!profile || profile.is_active === false) return false
      // super_admin and module_admin can reach every module.
      if (profile.role === 'super_admin' || profile.role === 'module_admin') return true
      // viewer / custom: governed by per-module permission rows.
      return permissions.some((p) => p.module === module && p.can_view)
    },
    [profile, permissions],
  )

  const value: AuthContextValue = {
    session,
    user,
    profile,
    permissions,
    loading,
    isSuperAdmin,
    googleProviderToken,
    hasModuleAccess,
    signOut,
    refreshProfile,
    reconnectGoogle,
    sessionTimeoutMinutes,
    setSessionTimeoutMinutes,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      {user && (
        <SessionTimeoutModal
          open={showTimeoutWarning}
          remainingMs={warningRemainingMs}
          onStay={() => void extendSession()}
          onLogout={() => void signOut()}
        />
      )}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
