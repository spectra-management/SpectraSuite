import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured, signInWithGoogle } from '@/shared/lib/supabase'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useEmployeeHrStore } from '@/shared/store/employeeHrStore'
import { usePayrollStore } from '@/shared/store/payrollStore'
import { useVacationPaymentsStore } from '@/shared/store/vacationPaymentsStore'
import { usePendingVacationIsrStore } from '@/shared/store/pendingVacationIsrStore'
import { usePayrollSettingsStore } from '@/shared/store/payrollSettingsStore'
import { useBaseballCardStore } from '@/shared/store/baseballCardStore'
import { useCountryFiscalStore } from '@/shared/store/countryFiscalStore'
import { useModuleVisibilityStore } from '@/shared/store/moduleVisibilityStore'
import { logAuditEvent } from '@/shared/lib/audit'
import { clearAuthSessionKeys } from '@/shared/lib/sessionReset'
import { SessionTimeoutModal } from '@/shared/components/SessionTimeoutModal'
import type { ProfileRow, ModulePermissionRow, ModuleId, ModulePerm, PermAction } from '@/shared/types/supabase'

const MODULES: ModuleId[] = ['nomina', 'rrhh', 'facturacion', 'documentos', 'gastos', 'it']

// Only corporate Google accounts may sign in. Any other domain is rejected at the
// auth boundary (signed out immediately + bounced to /login). The Login page reads
// the sessionStorage flag below to show the user why.
const ALLOWED_EMAIL_DOMAIN = 'spectramanagement.net'
export const DOMAIN_REJECTED_KEY = 'auth_domain_rejected'

interface AssignedRole { id: string; name: string; description: string | null }

function emptyPerms(): Record<ModuleId, ModulePerm> {
  const base = {} as Record<ModuleId, ModulePerm>
  for (const m of MODULES) base[m] = { can_view: false, can_edit: false, can_approve: false, can_admin: false }
  return base
}

// Aggregate permission rows (legacy user_module_permissions + role_permissions):
// a user has a permission if ANY of their roles/rows grants it.
function aggregatePerms(rows: Array<{ module: string; can_view: boolean; can_edit: boolean; can_approve: boolean; can_admin: boolean }>): Record<ModuleId, ModulePerm> {
  const agg = emptyPerms()
  for (const r of rows) {
    const m = r.module as ModuleId
    if (!agg[m]) continue
    agg[m] = {
      can_view: agg[m].can_view || !!r.can_view,
      can_edit: agg[m].can_edit || !!r.can_edit,
      can_approve: agg[m].can_approve || !!r.can_approve,
      can_admin: agg[m].can_admin || !!r.can_admin,
    }
  }
  return agg
}

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
  /** True for super_admin or module_admin — the "managers" who run the whole Suite. */
  isManager: boolean
  googleProviderToken: string | null
  /** Roles assigned to the signed-in user (new RBAC). */
  userRoles: AssignedRole[]
  /** Aggregated module permissions across all the user's roles. */
  userPermissions: Record<ModuleId, ModulePerm>
  /** Check access. `action` defaults to 'view'. super_admin (and legacy module_admin) bypass. */
  hasModuleAccess: (module: ModuleId, action?: PermAction) => boolean
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
  const [userRoles, setUserRoles] = useState<AssignedRole[]>([])
  const [userPermissions, setUserPermissions] = useState<Record<ModuleId, ModulePerm>>(emptyPerms)
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
    if (permError) {
      console.error('[auth] failed to load permissions:', permError.message)
    }
    const legacyPerms: ModulePermissionRow[] = permData ?? []
    setPermissions(legacyPerms)

    // New RBAC: assigned roles + their permissions.
    let rolePerms: Array<{ module: string; can_view: boolean; can_edit: boolean; can_approve: boolean; can_admin: boolean }> = []
    try {
      const { data: urData } = await supabase
        .from('user_roles')
        .select('role_id, roles(id, name, description)')
        .eq('user_id', uid)
      const assigned: AssignedRole[] = (urData ?? [])
        .map((r: { roles?: AssignedRole | AssignedRole[] | null }) =>
          Array.isArray(r.roles) ? r.roles[0] : r.roles)
        .filter((r): r is AssignedRole => !!r)
      setUserRoles(assigned)

      const roleIds = (urData ?? []).map((r: { role_id: string }) => r.role_id)
      if (roleIds.length > 0) {
        const { data: rp } = await supabase.from('role_permissions').select('*').in('role_id', roleIds)
        rolePerms = rp ?? []
      }
    } catch (e) {
      // roles tables may not exist yet (migration 006 not run) — fall back to legacy perms.
      console.warn('[auth] roles unavailable; using legacy permissions:', (e as Error).message)
      setUserRoles([])
    }

    // Aggregate legacy per-module perms + role perms (any grant wins).
    setUserPermissions(aggregatePerms([...legacyPerms, ...rolePerms]))
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

      // Corporate-domain gate: reject any non-@spectramanagement.net account.
      if (s?.user) {
        const email = s.user.email?.toLowerCase() ?? ''
        if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
          console.warn('[auth] login rejected: non-corporate email', s.user.email)
          try { sessionStorage.setItem(DOMAIN_REJECTED_KEY, '1') } catch { /* ignore */ }
          await supabase.auth.signOut()
          localStorage.removeItem(GOOGLE_TOKEN_KEY)
          localStorage.removeItem(GOOGLE_REFRESH_KEY)
          setSession(null)
          setUser(null)
          setProfile(null)
          setPermissions([])
          setLoading(false)
          if (!window.location.pathname.startsWith('/login')) window.location.assign('/login')
          return
        }
      }

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
      if (s?.user) {
        await loadProfile(s.user.id)
        // Cloud is authoritative once signed in: read business data back from Supabase
        // so connectors, payroll history and vacation state survive deploys, domain
        // changes, new devices, and localStorage clears. All best-effort + offline-safe:
        // each hydrate falls back to the localStorage cache if the cloud is unreachable.
        void useSettingsStore.getState().hydrateCompanyFromCloud()
        void useSettingsStore.getState().hydrateConnectorsFromCloud()
        void useSettingsStore.getState().hydrateSettingsFromCloud()
        void useEmployeeHrStore.getState().hydrateFromCloud()
        void usePayrollStore.getState().hydrateFromCloud()
        void useVacationPaymentsStore.getState().hydrateFromCloud()
        void usePendingVacationIsrStore.getState().hydrateFromCloud()
        void usePayrollSettingsStore.getState().hydrateFromCloud()
        void useBaseballCardStore.getState().hydrateFromCloud()
        void useCountryFiscalStore.getState().hydrateFromCloud()
        void useModuleVisibilityStore.getState().hydrateFromCloud()
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

  // Auto-logout on inactivity timeout. Clears ONLY auth/session keys — NOT the
  // business-data caches (employees, payroll history, settings, connectors). Those are
  // now cloud-authoritative and re-hydrated on the next login, so there is no reason to
  // wipe them here (the old `localStorage.clear()` destroyed real data on every timeout).
  const handleSessionExpired = useCallback(async () => {
    await logAuditEvent({ action: 'session_expired', category: 'auth', details: { reason: 'inactivity' } })
    await supabase.auth.signOut()
    clearAuthSessionKeys()
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
  // "Managers" run the Suite (full module access). Everyone else is a normal employee who
  // only gets the self-service profile. Mirrors the tablero_can_manage() DB definition.
  const isManager = profile?.role === 'super_admin' || profile?.role === 'module_admin'

  const hasModuleAccess = useCallback(
    (module: ModuleId, action: PermAction = 'view'): boolean => {
      if (!profile || profile.is_active === false) return false
      // super_admin and (legacy) module_admin can do everything.
      if (profile.role === 'super_admin' || profile.role === 'module_admin') return true
      const p = userPermissions[module]
      if (!p) return false
      switch (action) {
        case 'view': return p.can_view
        case 'edit': return p.can_view && p.can_edit
        case 'approve': return p.can_view && p.can_edit && p.can_approve
        case 'admin': return p.can_admin
        default: return false
      }
    },
    [profile, userPermissions],
  )

  const value: AuthContextValue = {
    session,
    user,
    profile,
    permissions,
    loading,
    isSuperAdmin,
    isManager,
    googleProviderToken,
    userRoles,
    userPermissions,
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
