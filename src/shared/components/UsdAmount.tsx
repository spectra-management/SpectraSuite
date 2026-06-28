import { cn } from '@/shared/lib/utils'
import { useExchangeRateStore } from '@/shared/store/exchangeRateStore'
import { formatUsd } from '@/shared/lib/exchangeRate'
import { currencyForCountry } from '@/shared/lib/utils/currency'

/**
 * Secondary USD equivalent of an amount expressed in a country's local currency, using the
 * live daily rate. Renders nothing when the country is already USD (no conversion needed) or
 * when no rate is available yet. Use UNDER a primary local-currency figure.
 */
export function UsdAmount({ amount, country, className }: { amount: number; country?: string | null; className?: string }) {
  const toUsd = useExchangeRateStore((s) => s.toUsd)
  const code = currencyForCountry(country).code
  if (code === 'USD') return null // local currency is already USD
  const usd = toUsd(amount, code)
  if (usd === null) return null
  return (
    <span className={cn('text-figure text-xs font-normal text-muted-foreground', className)}>
      ≈ {formatUsd(usd)}
    </span>
  )
}
