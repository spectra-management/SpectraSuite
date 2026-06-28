import { cn } from '@/shared/lib/utils'
import { useExchangeRateStore } from '@/shared/store/exchangeRateStore'
import { formatUsd } from '@/shared/lib/exchangeRate'
import { currencyForCountry } from '@/shared/lib/utils/currency'

/**
 * Secondary USD equivalent of an amount expressed in a country's local currency.
 *
 * Pass `rate` (units of the local currency per 1 USD) to convert with a FIXED rate — used for
 * historical payroll runs that froze the day's rate; otherwise the live daily rate is used.
 * Renders nothing when the country is already USD (no conversion needed) or no rate is known.
 */
export function UsdAmount({ amount, country, rate, className }: { amount: number; country?: string | null; rate?: number; className?: string }) {
  const toUsd = useExchangeRateStore((s) => s.toUsd)
  const code = currencyForCountry(country).code
  if (code === 'USD') return null // local currency is already USD
  const usd = rate && rate > 0 ? amount / rate : toUsd(amount, code)
  if (usd === null) return null
  return (
    <span className={cn('text-figure text-xs font-normal text-muted-foreground', className)}>
      ≈ {formatUsd(usd)}
    </span>
  )
}
