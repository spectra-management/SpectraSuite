import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Lock, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { SUITE_MODULES } from '@/lib/suiteModules'
import type { ModuleId, PermAction } from '@/types/supabase'

const ROLE_LABEL_KEY: Record<string, string> = {
  super_admin: 'users.roles.super_admin',
  module_admin: 'users.roles.module_admin',
  viewer: 'users.roles.viewer',
  custom: 'users.roles.custom',
}

export default function AccessDenied({ module, action }: { module?: ModuleId; action?: PermAction }) {
  const { t } = useTranslation()
  const { profile, hasModuleAccess } = useAuth()

  const accessibleModules = SUITE_MODULES.filter((m) => hasModuleAccess(m.id))
  const detailMsg = module
    ? t('auth.accessDenied.needPermission', {
        module: t(`suite.modules.${module}`),
        action: t(`users.canShort.${action ?? 'view'}`),
      })
    : t('auth.accessDenied.message')

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
          <Lock className="h-7 w-7 text-red-500" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-foreground">{t('auth.accessDenied.title')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{detailMsg}</p>

        {profile && (
          <div className="mt-6 space-y-3 rounded-xl bg-secondary p-4 text-left">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('auth.accessDenied.yourRole')}</span>
              <span className="font-semibold text-foreground">
                {t(ROLE_LABEL_KEY[profile.role] ?? 'users.roles.viewer')}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">{t('auth.accessDenied.yourModules')}</span>
              {accessibleModules.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {accessibleModules.map((m) => (
                    <Link
                      key={m.id}
                      to={m.path}
                      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                    >
                      <span>{m.icon}</span> {t(`suite.modules.${m.id}`)}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">{t('auth.accessDenied.noModules')}</p>
              )}
            </div>
          </div>
        )}

        <Button asChild variant="outline" className="mt-6 gap-2">
          <Link to="/suite">
            <ArrowLeft className="h-4 w-4" />
            {t('auth.accessDenied.back')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
