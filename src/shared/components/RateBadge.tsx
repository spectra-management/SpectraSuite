import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TrendingUp, Loader2 } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useExchangeRateStore } from '@/shared/store/exchangeRateStore'

/**
 * Small "rate of the day" badge for a corner of the screen. Shows the live USD -> DOP rate
 * and refreshes it once per day. Reads the shared exchange-rate cache.
 */
export function RateBadge({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const cache = useExchangeRateStore((s) => s.cache)
  const loading = useExchangeRateStore((s) => s.loading)
  const ensureFresh = useExchangeRateStore((s) => s.ensureFresh)

  useEffect(() => { void ensureFresh() }, [ensureFresh])

  const fmtRate = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const fmtDate = (iso: string) =>
    iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(
      i18n.language.startsWith('es') ? 'es-DO' : 'en-US',
      { day: 'numeric', month: 'short' },
    ) : ''

  return (
    <div className={cn('rounded-xl border border-border bg-card px-4 py-2 shadow-sm', className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        {t('rate.badgeLabel')}
      </div>
      {cache ? (
        <>
          <p className="text-figure text-sm font-bold text-foreground">
            RD$ {fmtRate(cache.rate)} <span className="text-xs font-normal text-muted-foreground">/ USD</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            {fmtDate(cache.date)} · {cache.source}
          </p>
        </>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {t('rate.unavailable')}
        </p>
      )}
    </div>
  )
}
