import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { useSettingsStore } from '@/store/settingsStore'
import type { ProfileRow, ModulePermissionRow, ModuleId } from '@/types/supabase'

// Supabase only returns the Google provider_token on the initial sign-in event,
// not from getSession() after a reload. Cache it so the Suite Dashboard's Google
// Tasks/Calendar widgets keep working across reloads (best-effort; may expire).
const GOOGLE_TOKEN_KEY = 'spectra_google_provider_token'

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

  const loadProfile = useCallback(async (uid: string) => {
    const fetchRow = () =>
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle()

    const { data: firstFetch, error } = await fetchRow()
    if (error) {
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

    const applySession = async (s: Session | null) => {
      if (!active) return
      setSession(s)
      setUser(s?.user ?? null)
      // provider_token only arrives on fresh OAuth; cache and reuse otherwise.
      if (s?.provider_token) {
        localStorage.setItem(GOOGLE_TOKEN_KEY, s.provider_token)
        setGoogleProviderToken(s.provider_token)
      }
      if (s?.user) {
        await loadProfile(s.user.id)
        // Cloud is authoritative for company settings once signed in.
        void useSettingsStore.getState().hydrateCompanyFromCloud()
      } else {
        setProfile(null)
        setPermissions([])
      }
      if (active) setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => applySession(data.session))

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      void applySession(s)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    localStorage.removeItem(GOOGLE_TOKEN_KEY)
    setGoogleProviderToken(null)
    setSession(null)
    setUser(null)
    setProfile(null)
    setPermissions([])
    window.location.assign('/login')
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
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
