import { roundHalfUp } from '@/modules/nomina/lib/payroll/calculations'

// BambooHR Vacation time-off type (confirmed for this account).
const VACATION_TYPE_ID = '83'

interface RawTimeOff {
  id: string | number
  employeeId: string | number
  name?: string
  type?: { id?: string | number; name?: string }
  start?: string
  end?: string
  amount?: { amount?: string | number }
  dates?: Record<string, string | number>
  status?: { status?: string }
}

export interface VacationRequest {
  id: string
  employeeId: string
  employeeName: string
  start: string            // YYYY-MM-DD
  end: string              // YYYY-MM-DD
  totalDays: number        // amount.amount as reported by BambooHR
  dates: Record<string, number> // per-day values: 1 = full, 0.5 = half, 0 = not counted
}

function normalizeDates(dates?: Record<string, string | number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [date, val] of Object.entries(dates ?? {})) out[date] = Number(val) || 0
  return out
}

/**
 * Actual vacation days from the `dates` object — the source of truth (handles half days).
 * Sum of all per-day values greater than 0.
 */
export function countVacationDays(dates: Record<string, number>): number {
  return roundHalfUp(
    Object.values(dates).reduce((sum, v) => (v > 0 ? sum + v : sum), 0),
    2,
  )
}

/**
 * Fetches approved Vacation requests (type 83) for a year via the /api/bamboohr proxy.
 * The proxy already filters to type 83; we re-filter client-side for safety.
 */
export async function fetchVacations(
  subdomain: string,
  apiKey: string,
  year: number,
): Promise<VacationRequest[]> {
  const qs = new URLSearchParams({
    path: '/v1/time_off/requests',
    subdomain,
    apiKey,
    status: 'approved',
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  })

  const res = await fetch(`/api/bamboohr?${qs.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(err.error ?? `BambooHR error ${res.status}`)
  }

  const data = (await res.json()) as RawTimeOff[]
  return (Array.isArray(data) ? data : [])
    .filter((r) => String(r.type?.id) === VACATION_TYPE_ID)
    .map((r) => ({
      id: String(r.id),
      employeeId: String(r.employeeId),
      employeeName: r.name ?? '',
      start: r.start ?? '',
      end: r.end ?? '',
      totalDays: Number(r.amount?.amount ?? 0) || 0,
      dates: normalizeDates(r.dates),
    }))
}

export function getVacationsForEmployee(employeeId: string, vacations: VacationRequest[]): VacationRequest[] {
  return vacations.filter((v) => v.employeeId === String(employeeId))
}

/** Vacations overlapping [periodStart, periodEnd] (inclusive, YYYY-MM-DD string compare). */
export function getVacationsOverlappingPeriod(
  vacations: VacationRequest[],
  periodStart: string,
  periodEnd: string,
): VacationRequest[] {
  return vacations.filter((v) => v.start && v.end && v.start <= periodEnd && v.end >= periodStart)
}
