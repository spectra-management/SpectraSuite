import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card'
import { Switch } from '@/shared/components/ui/switch'
import { SUITE_MODULES } from '@/shared/lib/suiteModules'
import { MODULE_ICONS } from '@/shared/components/moduleIcons'
import { useModuleVisibilityStore } from '@/shared/store/moduleVisibilityStore'
import { logAuditEvent } from '@/shared/lib/audit'
import { toast } from '@/shared/hooks/useToast'

/**
 * Super-admin control to hide Suite modules from everyone (launcher, dashboard
 * cards, and direct routes). The choice is shared across all users via the DB.
 * Rendered only inside Suite Settings, whose route is gated to super_admin.
 */
export function ModuleVisibilityPanel() {
  const { t } = useTranslation()
  const hidden = useModuleVisibilityStore((s) => s.hidden)
  const setHidden = useModuleVisibilityStore((s) => s.setHidden)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('suite.settings.moduleVisibility')}</CardTitle>
        <CardDescription>{t('suite.settings.moduleVisibilityDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {SUITE_MODULES.map((m) => {
          const Icon = MODULE_ICONS[m.id]
          const isVisible = !hidden.includes(m.id)
          return (
            <div
              key={m.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(`suite.modules.${m.id}`)}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    {isVisible
                      ? <><Eye className="h-3 w-3" />{t('suite.settings.moduleVisible')}</>
                      : <><EyeOff className="h-3 w-3" />{t('suite.settings.moduleHidden')}</>}
                  </p>
                </div>
              </div>
              <Switch
                checked={isVisible}
                onCheckedChange={(checked) => {
                  setHidden(m.id, !checked)
                  void logAuditEvent({
                    action: checked ? 'module_shown' : 'module_hidden',
                    category: 'settings',
                    details: { module: m.id },
                  })
                  toast({ variant: 'success', title: t('common.success') })
                }}
                aria-label={t(`suite.modules.${m.id}`)}
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
