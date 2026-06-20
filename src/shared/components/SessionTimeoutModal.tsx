import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`
}

/**
 * Inactivity warning shown at 95% of the configured session timeout. Counts down
 * to auto-logout; "Stay Logged In" refreshes the session and resets the timer.
 */
export function SessionTimeoutModal({
  open, remainingMs, onStay, onLogout,
}: {
  open: boolean
  remainingMs: number
  onStay: () => void
  onLogout: () => void
}) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-soft-lg">
        <div className="flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
            <Clock className="h-6 w-6" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-foreground">{t('auth.sessionWarning.title')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('auth.sessionWarning.message', { time: formatRemaining(remainingMs) })}
          </p>
          <p className="text-figure mt-3 text-2xl font-bold tabular-nums text-foreground">
            {formatRemaining(remainingMs)}
          </p>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={onStay} className="w-full">{t('auth.sessionWarning.stay')}</Button>
          <Button variant="outline" onClick={onLogout} className="w-full">{t('auth.sessionWarning.logout')}</Button>
        </div>
      </div>
    </div>
  )
}
