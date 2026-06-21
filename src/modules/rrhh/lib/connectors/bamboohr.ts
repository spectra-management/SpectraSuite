/**
 * RRHH BambooHR connector — READ-ONLY.
 *
 * Talks to the shared `/api/bamboohr` proxy. Every call here is a read:
 *   - GET  /api/bamboohr?path=/v1/time_off/requests   (list time-off)
 *   - POST /api/bamboohr?path=/v1/reports/custom       (generate a custom report)
 *
 * NOTE: the custom-report POST is a *read* — BambooHR generates a report from existing
 * data; it does not mutate anything. No employee-mutating verb is ever issued.
 *
 * This duplicates a little mapping logic from the Nómina connector on purpose: module
 * isolation (IMPORT_RULES) forbids `modules/rrhh` importing from `modules/nomina`.
 */

import type {
  RrhhEmployee,
  RrhhEmployeeStatus,
  RrhhTimeOffRequest,
} from '@/modules/rrhh/types'

interface BambooReportEmployee {
  id: string | number
  employeeNumber?: string
  firstName?: string
  lastName?: string
  preferredName?: string
  displayName?: string
  jobTitle?: string
  department?: string
  division?: string
  location?: string
  hireDate?: string
  employmentHistoryStatus?: string
  supervisor?: string
  supervisorEId?: string | number
  workEmail?: string
  mobilePhone?: string
  workPhone?: string
  gender?: string
  dateOfBirth?: string
  maritalStatus?: string
  nationality?: string
  country?: string
  city?: string
  state?: string
  address1?: string
  payRate?: string
  payType?: string
  payPer?: string
  photoUrl?: string
}

interface BambooReportResponse {
  employees: BambooReportEmployee[]
}

/** Custom-report fields requested from BambooHR (read-only HR profile fields). */
const REPORT_FIELDS = [
  'id',
  'employeeNumber',
  'firstName',
  'lastName',
  'preferredName',
  'displayName',
  'jobTitle',
  'department',
  'division',
  'location',
  'hireDate',
  'employmentHistoryStatus',
  'supervisor',
  'supervisorEId',
  'workEmail',
  'mobilePhone',
  'workPhone',
  'gender',
  'dateOfBirth',
  'maritalStatus',
  'nationality',
  'country',
  'city',
  'state',
  'address1',
  'payRate',
  'payType',
  'payPer',
  'photoUrl',
] as const

function mapStatus(raw: string | null | undefined): RrhhEmployeeStatus {
  const s = (raw ?? '').toLowerCase().trim()
  if (s === 'terminated') return 'Terminated'
  if (s === 'inactive') return 'Inactive'
  return 'Active'
}

function mapPayType(
  payType: string | null | undefined,
  payPer: string | null | undefined,
): RrhhEmployee['payType'] {
  const pt = (payType ?? '').trim().toLowerCase()
  if (pt.startsWith('hourly')) return 'Hourly'
  if (pt === 'salary' || pt === 'salaried') return 'Salary'
  const pp = (payPer ?? '').trim().toLowerCase()
  if (pp === 'hour') return 'Hourly'
  if (pp === 'year' || pp === 'month' || pp === 'week' || pp === 'biweek') return 'Salary'
  return ''
}

/** Parse a BambooHR payRate string ("15.00 USD", "850.00 DOP", ""). */
function parsePayRate(raw: string | null | undefined): { rate: number; currency: string } {
  if (!raw || !raw.trim()) return { rate: 0, currency: '' }
  const parts = raw.trim().split(' ')
  const rate = parseFloat(parts[0] ?? '0') || 0
  const currency = parts[1] ?? ''
  return { rate, currency }
}

function fullName(e: BambooReportEmployee): string {
  const display = (e.displayName ?? '').trim()
  if (display) return display
  return `${e.firstName ?? ''} ${e.lastName ?? ''}`.trim()
}

/**
 * Fetch the full HR directory via the BambooHR custom-report endpoint (read-only).
 * @throws Error with a human-readable message on failure.
 */
export async function fetchRrhhDirectory(
  subdomain: string,
  apiKey: string,
): Promise<RrhhEmployee[]> {
  const qs = new URLSearchParams({
    path: '/v1/reports/custom',
    subdomain,
    apiKey,
    format: 'JSON',
  })

  const res = await fetch(`/api/bamboohr?${qs.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: [...REPORT_FIELDS] }),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
    throw new Error(err.error ?? `BambooHR error ${res.status}`)
  }

  const data = (await res.json()) as BambooReportResponse

  return (data.employees ?? []).map((e): RrhhEmployee => {
    const { rate, currency } = parsePayRate(e.payRate)
    return {
      id: String(e.id),
      employeeNumber: e.employeeNumber ?? '',
      firstName: e.firstName ?? '',
      lastName: e.lastName ?? '',
      preferredName: e.preferredName ?? '',
      displayName: fullName(e),
      jobTitle: e.jobTitle ?? '',
      department: e.department ?? '',
      division: e.division ?? '',
      location: e.location ?? '',
      hireDate: e.hireDate ?? '',
      status: mapStatus(e.employmentHistoryStatus),
      supervisor: e.supervisor ?? '',
      supervisorId: e.supervisorEId != null ? String(e.supervisorEId) : '',
      workEmail: e.workEmail ?? '',
      mobilePhone: e.mobilePhone ?? '',
      workPhone: e.workPhone ?? '',
      gender: e.gender ?? '',
      dateOfBirth: e.dateOfBirth ?? '',
      maritalStatus: e.maritalStatus ?? '',
      nationality: e.nationality ?? '',
      country: e.country ?? '',
      city: e.city ?? '',
      state: e.state ?? '',
      address: e.address1 ?? '',
      payRate: rate,
      payRateCurrency: currency,
      payType: mapPayType(e.payType, e.payPer),
      photoUrl: e.photoUrl ?? '',
    }
  })
}

interface RawTimeOff {
  id: string | number
  employeeId: string | number
  name?: string
  type?: { id?: string | number; name?: string }
  start?: string
  end?: string
  amount?: { amount?: string | number }
  status?: { status?: string } | string
}

function timeOffStatus(status: RawTimeOff['status']): string {
  if (typeof status === 'string') return status
  return status?.status ?? ''
}

/**
 * Fetch approved time-off requests for a year via the proxy (read-only).
 *
 * NOTE: the shared `/api/bamboohr` proxy filters `time_off/requests` to BambooHR
 * Vacation (type id 83). This view therefore shows Vacation/PTO. Surfacing other
 * time-off types would require changing the shared proxy (which Nómina depends on),
 * so it is intentionally out of scope here. See RRHH_PROGRESS.md §4.
 */
export async function fetchRrhhTimeOff(
  subdomain: string,
  apiKey: string,
  year: number,
): Promise<RrhhTimeOffRequest[]> {
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
    const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
    throw new Error(err.error ?? `BambooHR error ${res.status}`)
  }

  const data = (await res.json()) as RawTimeOff[]
  return (Array.isArray(data) ? data : []).map((r): RrhhTimeOffRequest => ({
    id: String(r.id),
    employeeId: String(r.employeeId),
    employeeName: r.name ?? '',
    typeName: r.type?.name ?? 'Vacation',
    typeId: r.type?.id != null ? String(r.type.id) : '',
    start: r.start ?? '',
    end: r.end ?? '',
    days: Number(r.amount?.amount ?? 0) || 0,
    status: timeOffStatus(r.status),
  }))
}
