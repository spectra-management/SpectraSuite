import { useTranslation } from 'react-i18next'
import { Trophy } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card'
import { Switch } from '@/shared/components/ui/switch'
import { useRewardsStore, DAILY_POINTS } from '@/shared/store/rewardsStore'
import { logAuditEvent } from '@/shared/lib/audit'
import { toast } from '@/shared/hooks/useToast'

/**
 * Super-admin toggle for the daily-rewards system. Shared across all users via app_state.
 * Rendered inside Suite Settings, whose route is gated to super_admin.
 */
export function RewardsSettingsPanel() {
  const { t } = useTranslation()
  const enabled = useRewardsStore((s) => s.enabled)
  const setEnabled = useRewardsStore((s) => s.setEnabled)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('rewards.settingsTitle')}</CardTitle>
        <CardDescription>{t('rewards.settingsDesc', { points: DAILY_POINTS })}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <Trophy className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">{t('rewards.settingsToggle')}</p>
              <p className="text-xs text-muted-foreground">
                {enabled ? t('rewards.stateOn') : t('rewards.stateOff')}
              </p>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(checked) => {
              setEnabled(checked)
              void logAuditEvent({
                action: checked ? 'rewards_enabled' : 'rewards_disabled',
                category: 'settings',
              })
              toast({ variant: 'success', title: t('common.success') })
            }}
            aria-label={t('rewards.settingsToggle')}
          />
        </div>
      </CardContent>
    </Card>
  )
}
