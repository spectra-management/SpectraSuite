import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import AccessDenied from '@/pages/AccessDenied'
import type { ModuleId, PermAction } from '@/types/supabase'

interface Props {
  children: ReactNode
  /** Restrict to a specific Suite module. */
  module?: ModuleId
  /** Required action on the module (default 'view'). */
  action?: PermAction
  /** Restrict to super_admin only (e.g. Suite Settings). */
  requireSuperAdmin?: boolean
}

export function ProtectedRoute({ children, module, action = 'view', requireSuperAdmin }: Props) {
  const { user, profile, loading, isSuperAdmin, hasModuleAccess } = useAuth()

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

  if (module && !hasModuleAccess(module, action)) {
    return <AccessDenied module={module} action={action} />
  }

  return <>{children}</>
}
