/**
 * Billing display helpers. On-screen money uses the shared `formatCurrency`
 * (symbol + locale grouping). The PDF variant swaps any non-Latin currency symbol
 * (e.g. ₱) for its ISO code so the built-in Helvetica never drops a glyph.
 */

import { roundHalfUp, safeNum } from '@/shared/lib/number'
import { currencyForCountry } from '@/shared/lib/utils/currency'

const LATIN1 = /^[\x20-\xFF]*$/

/** PDF-safe money format, e.g. "RD$ 1,234.56" or "PHP 1,234.56". */
export function formatMoneyPdf(amount: number, country: string | null | undefined): string {
  const cur = currencyForCountry(country)
  const symbol = LATIN1.test(cur.symbol) ? cur.symbol : cur.code
  const n = roundHalfUp(safeNum(amount), 2)
  return `${symbol} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Compact hours format (drops trailing .00). */
export function formatHours(h: number): string {
  const n = roundHalfUp(safeNum(h), 2)
  return Number.isInteger(n) ? String(n) : n.toFixed(2)
}
