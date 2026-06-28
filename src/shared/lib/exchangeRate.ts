/**
 * Live USD -> DOP exchange rate (Dominican peso).
 *
 * Primary source : open.er-api.com  (free, no API key, open CORS)
 * Fallback       : exchangerate.host (used automatically if the primary fails)
 *
 * Both are called directly from the browser (open CORS), so no serverless proxy is needed.
 * The rate is "DOP per 1 USD" (e.g. 59.5). Callers convert pesos -> USD as `pesos / rate`.
 */

export interface ExchangeRate {
  /** DOP per 1 USD. */
  rate: number
  /** Day the rate applies to (YYYY-MM-DD, local). */
  date: string
  /** Which provider supplied it. */
  source: string
}

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

async function fromOpenErApi(): Promise<ExchangeRate | null> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    if (!res.ok) return null
    const json = (await res.json()) as { result?: string; rates?: Record<string, number> }
    const rate = json?.rates?.DOP
    if (json?.result === 'success' && typeof rate === 'number' && rate > 0) {
      return { rate, date: todayLocal(), source: 'open.er-api.com' }
    }
    return null
  } catch (e) {
    console.warn('[fx] open.er-api.com failed:', e)
    return null
  }
}

async function fromExchangerateHost(): Promise<ExchangeRate | null> {
  try {
    const res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=DOP')
    if (!res.ok) return null
    const json = (await res.json()) as { rates?: Record<string, number> }
    const rate = json?.rates?.DOP
    if (typeof rate === 'number' && rate > 0) {
      return { rate, date: todayLocal(), source: 'exchangerate.host' }
    }
    return null
  } catch (e) {
    console.warn('[fx] exchangerate.host failed:', e)
    return null
  }
}

/**
 * Fetch today's USD->DOP rate from the primary source, falling back to the secondary
 * automatically. Returns null only if BOTH providers fail (caller keeps the last cache).
 */
export async function fetchUsdToDop(): Promise<ExchangeRate | null> {
  return (await fromOpenErApi()) ?? (await fromExchangerateHost())
}
