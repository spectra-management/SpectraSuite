import { cn } from '@/shared/lib/utils'
import { useExchangeRateStore } from '@/shared/store/exchangeRateStore'
import { formatUsd } from '@/shared/lib/exchangeRate'

/**
 * Secondary USD equivalent of a Dominican-peso (DOP) amount, using the live daily rate.
 * Renders nothing when no rate is available yet. Use UNDER a primary RD$ figure.
 */
export function UsdAmount({ dop, className }: { dop: number; className?: string }) {
  const toUsd = useExchangeRateStore((s) => s.toUsd)
  const usd = toUsd(dop)
  if (usd === null) return null
  return (
    <span className={cn('text-figure text-xs font-normal text-muted-foreground', className)}>
      ≈ {formatUsd(usd)}
    </span>
  )
}
