// Country → currency mapping for display. Every monetary value shown in the app
// is formatted with the currency of the country being processed (no conversion —
// Global runs keep each employee's native currency).

import { roundHalfUp, safeNum } from '@/shared/lib/number'

export interface CurrencyInfo {
  symbol: string
  code: string
  locale: string
}

export const COUNTRY_CURRENCIES: Record<string, CurrencyInfo> = {
  'Dominican Republic': { symbol: 'RD$', code: 'DOP', locale: 'es-DO' },
  'Mexico': { symbol: 'MX$', code: 'MXN', locale: 'es-MX' },
  'United States': { symbol: '$', code: 'USD', locale: 'en-US' },
  'Jamaica': { symbol: 'J$', code: 'JMD', locale: 'en-JM' },
  'Philippines': { symbol: '₱', code: 'PHP', locale: 'fil-PH' },
  'Kenya': { symbol: 'KSh', code: 'KES', locale: 'sw-KE' },
}

const DEFAULT_CURRENCY: CurrencyInfo = { symbol: '$', code: 'USD', locale: 'en-US' }

// Tolerant lookup: handles exact names, common variants, and case/whitespace.
export function currencyForCountry(country: string | null | undefined): CurrencyInfo {
  if (!country) return DEFAULT_CURRENCY
  if (COUNTRY_CURRENCIES[country]) return COUNTRY_CURRENCIES[country]
  const c = country.toLowerCase().trim()
  if (c.includes('dominican') || c === 'do' || c === 'rd') return COUNTRY_CURRENCIES['Dominican Republic']
  if (c.includes('mexic') || c.includes('méxic')) return COUNTRY_CURRENCIES['Mexico']
  if (c.includes('united states') || c === 'us' || c === 'usa') return COUNTRY_CURRENCIES['United States']
  if (c.includes('jamaica')) return COUNTRY_CURRENCIES['Jamaica']
  if (c.includes('philippine') || c.includes('filipin')) return COUNTRY_CURRENCIES['Philippines']
  if (c.includes('kenya')) return COUNTRY_CURRENCIES['Kenya']
  return DEFAULT_CURRENCY
}

/** Currency symbol for a country (e.g. 'RD$', 'MX$', '$'). */
export function currencySymbol(country: string | null | undefined): string {
  return currencyForCountry(country).symbol
}

/**
 * Format a monetary amount in the country's currency, e.g. `RD$ 1,234.56`.
 * Uses the country locale for digit grouping; always 2 decimals, half-up rounded.
 */
export function formatCurrency(amount: number, country?: string | null): string {
  const cur = currencyForCountry(country)
  const rounded = roundHalfUp(safeNum(amount), 2)
  return `${cur.symbol} ${rounded.toLocaleString(cur.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
