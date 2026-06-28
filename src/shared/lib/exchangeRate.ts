/**
 * Live foreign-exchange rates for every payroll country, expressed against the US dollar.
 *
 * Primary source : open.er-api.com  (free, no API key, open CORS) — returns ALL currencies
 *                  in a single call, so one fetch covers every country we process.
 * Fallback       : exchangerate.host (used automatically if the primary fails)
 *
 * Both are called directly from the browser (open CORS), so no serverless proxy is needed.
 * `rates[code]` is "units of that currency per 1 USD" (e.g. rates.DOP ~= 59, rates.USD = 1).
 * Convert a local amount to USD as `amount / rates[code]`.
 */

import { COUNTRY_CURRENCIES } from '@/shared/lib/utils/currency'

export interface RatesSnapshot {
  /** Currency code (DOP, MXN, USD, …) -> units per 1 USD. */
  rates: Record<string, number>
  /** Day the rates apply to (YYYY-MM-DD, local). */
  date: string
  /** Which provider supplied them. */
  source: string
}

/** Currency codes we actually need (the payroll countries). USD is always included. */
const NEEDED_CODES = Array.from(
  new Set(['USD', ...Object.values(COUNTRY_CURRENCIES).map((c) => c.code)]),
)

/** Format a USD value as `US$ 1,234.56`. */
export function formatUsd(value: number): string {
  return `US$ ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Local calendar day (YYYY-MM-DD) — rates are refreshed once per day. */
export function todayLocal(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Keep only the codes we use (and only positive numbers). USD forced to 1. */
function pickRates(all: Record<string, number> | undefined): Record<string, number> | null {
  if (!all) return null
  const out: Record<string, number> = { USD: 1 }
  for (const code of NEEDED_CODES) {
    const v = all[code]
    if (typeof v === 'number' && v > 0) out[code] = v
  }
  // Need at least one non-USD rate to be useful.
  return Object.keys(out).length > 1 ? out : null
}

async function fromOpenErApi(): Promise<RatesSnapshot | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    if (!res.ok) return null
    const json = (await res.json()) as { result?: string; rates?: Record<string, number> }
    if (json?.result !== 'success') return null
    const rates = pickRates(json.rates)
    return rates ? { rates, date: todayLocal(), source: 'open.er-api.com' } : null
  } catch (e) {
    console.warn('[fx] open.er-api.com failed:', e)
    return null
  }
}

async function fromExchangerateHost(): Promise<RatesSnapshot | null> {
  try {
    const symbols = NEEDED_CODES.join(',')
    const res = await fetch(`https://api.exchangerate.host/latest?base=USD&symbols=${symbols}`)
    if (!res.ok) return null
    const json = (await res.json()) as { rates?: Record<string, number> }
    const rates = pickRates(json.rates)
    return rates ? { rates, date: todayLocal(), source: 'exchangerate.host' } : null
  } catch (e) {
    console.warn('[fx] exchangerate.host failed:', e)
    return null
  }
}

/**
 * Fetch today's rates from the primary source, falling back to the secondary automatically.
 * Returns null only if BOTH providers fail (caller keeps the last cache).
 */
export async function fetchRates(): Promise<RatesSnapshot | null> {
  return (await fromOpenErApi()) ?? (await fromExchangerateHost())
}
