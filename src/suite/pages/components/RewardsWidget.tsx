import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Flame, Trophy, Star, Award, CalendarCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'
import { toast } from '@/shared/hooks/useToast'
import { useRewardsStore, REWARD_MILESTONES } from '@/shared/store/rewardsStore'

/**
 * Daily-rewards widget for the self-service mini-home. Runs the once-per-day check-in on
 * mount (only when the super admin has the system enabled), shows points + streak + best
 * streak + milestone badges, and toasts the points earned today.
 */
export function RewardsWidget() {
  const { t } = useTranslation()
  const enabled = useRewardsStore((s) => s.enabled)
  const rewards = useRewardsStore((s) => s.rewards)
  const todayEarned = useRewardsStore((s) => s.todayEarned)
  const checkIn = useRewardsStore((s) => s.checkIn)
  const clearTodayEarned = useRewardsStore((s) => s.clearTodayEarned)
  const didCheckIn = useRef(false)

  useEffect(() => {
    if (!enabled || didCheckIn.current) return
    didCheckIn.current = true
    void checkIn()
  }, [enabled, checkIn])

  // Toast the points earned today, once.
  useEffect(() => {
    if (todayEarned && todayEarned > 0) {
      toast({ variant: 'success', title: t('rewards.earnedToast', { points: todayEarned }) })
      clearTodayEarned()
    }
  }, [todayEarned, clearTodayEarned, t])

  if (!enabled) return null

  return (
    <Card className="h-full overflow-hidden border-t-2 border-t-emerald-600">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Trophy className="h-4 w-4" strokeWidth={1.75} />
          </span>
          {t('rewards.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Star className="h-4 w-4" />} label={t('rewards.points')} value={String(rewards.points)} />
          <Stat icon={<Flame className="h-4 w-4" />} label={t('rewards.streak')} value={t('rewards.days', { count: rewards.streak })} />
          <Stat icon={<CalendarCheck className="h-4 w-4" />} label={t('rewards.totalDays')} value={String(rewards.totalDays)} />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('rewards.badges')}</p>
          <div className="flex flex-wrap gap-2">
            {REWARD_MILESTONES.map((m) => {
              const earned = rewards.bestStreak >= m
              return (
                <div
                  key={m}
                  title={t('rewards.milestoneTitle', { count: m })}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
                    earned
                      ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
                      : 'border-border bg-secondary text-muted-foreground/60',
                  )}
                >
                  <Award className="h-3.5 w-3.5" />
                  {t('rewards.days', { count: m })}
                </div>
              )
            })}
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{t('rewards.hint')}</p>
      </CardContent>
    </Card>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400">{icon}</div>
      <p className="text-figure mt-1 truncate text-lg font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  )
}
