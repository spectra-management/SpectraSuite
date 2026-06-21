/** Small presentation helpers for the RRHH module. */

import { formatPayRate } from '@/shared/lib/utils'
import type { RrhhEmployee, RrhhCompensationEntry } from '@/modules/rrhh/types'

/**
 * Mask a national ID / SSN, revealing only the last 4 characters: "•••• •••• 1234".
 * Returns '—' for an empty value. Used whenever the viewer lacks sensitive access (and
 * even then we never show the full value in the read-only profile).
 */
export function maskNationalId(value: string | undefined): string {
  // Strip separators (spaces, dashes, dots) so we reveal the last 4 significant chars.
  const v = (value ?? '').replace(/[^a-zA-Z0-9]/g, '')
  if (!v) return '—'
  const last4 = v.slice(-4)
  return `•••• •••• ${last4}`
}

/** Compensation-entry display, e.g. "RD$ 150.00/hr" or "RD$ 80,000.00/yr". */
export function compRateDisplay(entry: RrhhCompensationEntry): string {
  const base = formatPayRate(entry.rate, entry.currency)
  if (base === 'Not set') return '—'
  const per = (entry.paidPer ?? '').toLowerCase()
  if (per === 'hour') return `${base}/hr`
  if (per === 'year') return `${base}/yr`
  if (per === 'month') return `${base}/mo`
  if (per === 'week') return `${base}/wk`
  return base
}

export function countryFlag(country: string | undefined): string {
  const c = (country ?? '').toLowerCase().trim()
  if (c.includes('dominican')) return '🇩🇴'
  if (c.includes('united states') || c === 'us' || c === 'usa') return '🇺🇸'
  if (c.includes('jamaica')) return '🇯🇲'
  if (c.includes('philippines') || c.includes('filipinas')) return '🇵🇭'
  if (c.includes('kenya')) return '🇰🇪'
  if (c.includes('mexico') || c.includes('méxico')) return '🇲🇽'
  if (c.includes('haiti') || c.includes('haití')) return '🇭🇹'
  if (c.includes('puerto rico')) return '🇵🇷'
  if (c.includes('canada') || c.includes('canadá')) return '🇨🇦'
  if (c.includes('colombia')) return '🇨🇴'
  if (c.includes('venezuela')) return '🇻🇪'
  if (c.includes('panama') || c.includes('panamá')) return '🇵🇦'
  if (c.includes('costa rica')) return '🇨🇷'
  if (c.includes('cuba')) return '🇨🇺'
  if (c.includes('spain') || c.includes('españa')) return '🇪🇸'
  if (c.includes('argentina')) return '🇦🇷'
  return '🌍'
}

/** Pay-rate display, e.g. "RD$ 150.00/hr" or "Not set". */
export function payRateDisplay(emp: RrhhEmployee): string {
  if (emp.payRateCurrency === '' && emp.payRate === 0) return ''
  const base = formatPayRate(emp.payRate, emp.payRateCurrency)
  if (base === 'Not set') return ''
  return emp.payType === 'Hourly' ? `${base}/hr` : base
}

/**
 * Tenure from hire date to `now`, as { years, months }. Returns null for an empty or
 * future hire date. `now` is injectable for testability.
 */
export function tenureFrom(hireDate: string, now: Date = new Date()): { years: number; months: number } | null {
  if (!hireDate) return null
  const start = new Date(hireDate + 'T00:00:00')
  if (Number.isNaN(start.getTime()) || start > now) return null
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) months = 0
  return { years: Math.floor(months / 12), months: months % 12 }
}
