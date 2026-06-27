import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/shared/context/AuthContext'
import { isSupabaseConfigured } from '@/shared/lib/supabase'
import AccessDenied from '@/shared/components/AccessDenied'
import { useModuleVisibilityStore } from '@/shared/store/moduleVisibilityStore'
import type { ModuleId, PermAction } from '@/shared/types/supabase'
import type { SuiteModuleId } from '@/shared/lib/suiteModules'

interface Props {
  children: ReactNode
  /** Restrict to a specific Suite module. */
  module?: ModuleId
  /** Required action on the module (default 'view'). */
  action?: PermAction
  /** Restrict to super_admin only (e.g. Suite Settings). */
  requireSuperAdmin?: boolean
  /** Restrict to managers (super_admin or module_admin), e.g. the news manager. */
  requireManager?: boolean
}

export function ProtectedRoute({ children, module, action = 'view', requireSuperAdmin, requireManager }: Props) {
  const { user, profile, loading, isSuperAdmin, isManager, hasModuleAccess } = useAuth()
  const isModuleHidden = useModuleVisibilityStore((s) => s.isHidden)

  // If Supabase isn't configured (offline/local build), don't lock the app out.
  if (!isSupabaseConfigured) return <>{children}</>

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  // Disabled account → treated as no access.
  if (profile && profile.is_active === false) return <AccessDenied />

  if (requireSuperAdmin && !isSuperAdmin) return <AccessDenied />

  if (requireManager && !isManager) return <AccessDenied />

  if (module && !hasModuleAccess(module, action)) {
    return <AccessDenied module={module} action={action} />
  }

  // Super-admin can hide a module from everyone. Hidden → route is unreachable; the
  // super admin keeps access so they can still open it and toggle it back on in Settings.
  if (module && !isSuperAdmin && isModuleHidden(module as SuiteModuleId)) {
    return <Navigate to="/suite" replace />
  }

  return <>{children}</>
}
