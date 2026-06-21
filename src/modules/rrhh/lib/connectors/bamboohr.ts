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
  RrhhEmergencyContact,
  RrhhCompensationEntry,
  RrhhDocument,
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
  homeEmail?: string
  mobilePhone?: string
  workPhone?: string
  homePhone?: string
  gender?: string
  dateOfBirth?: string
  maritalStatus?: string
  nationality?: string
  country?: string
  city?: string
  state?: string
  address1?: string
  address2?: string
  zipcode?: string
  ssn?: string
  payRate?: string
  payType?: string
  payPer?: string
  paySchedule?: string
  payGroup?: string
  exempt?: string
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
  'homeEmail',
  'mobilePhone',
  'workPhone',
  'homePhone',
  'gender',
  'dateOfBirth',
  'maritalStatus',
  'nationality',
  'country',
  'city',
  'state',
  'address1',
  'address2',
  'zipcode',
  'ssn',
  'payRate',
  'payType',
  'payPer',
  'paySchedule',
  'payGroup',
  'exempt',
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
      personalEmail: e.homeEmail ?? '',
      mobilePhone: e.mobilePhone ?? '',
      workPhone: e.workPhone ?? '',
      homePhone: e.homePhone ?? '',
      gender: e.gender ?? '',
      dateOfBirth: e.dateOfBirth ?? '',
      maritalStatus: e.maritalStatus ?? '',
      nationality: e.nationality ?? '',
      country: e.country ?? '',
      city: e.city ?? '',
      state: e.state ?? '',
      address: e.address1 ?? '',
      address2: e.address2 ?? '',
      zipcode: e.zipcode ?? '',
      ssn: e.ssn ?? '',
      payRate: rate,
      payRateCurrency: currency,
      payType: mapPayType(e.payType, e.payPer),
      payPer: e.payPer ?? '',
      paySchedule: e.paySchedule ?? '',
      payGroup: e.payGroup ?? '',
      exempt: e.exempt ?? '',
      photoUrl: e.photoUrl ?? '',
    }
  })
}

/**
 * Build a read-only URL to an employee's BambooHR photo, routed through the shared
 * proxy (GET /v1/employees/{id}/photo/{size}). The proxy streams the binary so an
 * <img> can render it. Returns '' when the subdomain/id are missing.
 *
 * SECURITY: the BambooHR apiKey is deliberately NOT included here. Sending it as a URL
 * query param would leak the secret into browser history, server access logs, and the
 * Network tab. The proxy attaches the credential server-side from `BAMBOOHR_API_KEY`
 * instead (see `api/bamboohr.ts`). The client only ever passes the path, the (non-secret)
 * subdomain, and the size.
 *
 * NOTE: this is a *read* — it only fetches the existing photo. `size` is one of
 * BambooHR's named sizes: original | large | medium | small | xs | tiny.
 */
export function buildPhotoProxyUrl(
  subdomain: string,
  employeeId: string,
  size: 'large' | 'medium' | 'small' = 'small',
): string {
  if (!subdomain || !employeeId) return ''
  const qs = new URLSearchParams({
    path: `/v1/employees/${employeeId}/photo/${size}`,
    subdomain,
  })
  return `/api/bamboohr?${qs.toString()}`
}

interface RawTableRow {
  id?: string | number
  employeeId?: string | number
  // values live under a nested object keyed by column alias
  [key: string]: unknown
}

function rowStr(row: RawTableRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

/**
 * Fetch an employee's emergency contacts (read-only) from the BambooHR
 * `emergencyContacts` table. Returns [] when the account exposes none.
 * @throws Error with a human-readable message on a hard failure.
 */
export async function fetchRrhhEmergencyContacts(
  subdomain: string,
  apiKey: string,
  employeeId: string,
): Promise<RrhhEmergencyContact[]> {
  const qs = new URLSearchParams({
    path: `/v1/employees/${employeeId}/tables/emergencyContacts`,
    subdomain,
    apiKey,
  })

  const res = await fetch(`/api/bamboohr?${qs.toString()}`)
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
    throw new Error(err.error ?? `BambooHR error ${res.status}`)
  }

  const data = (await res.json()) as RawTableRow[]
  return (Array.isArray(data) ? data : []).map((r): RrhhEmergencyContact => ({
    id: String(r.id ?? ''),
    name: rowStr(r, 'name'),
    relationship: rowStr(r, 'relationship'),
    mobilePhone: rowStr(r, 'mobilePhone', 'phone'),
    homePhone: rowStr(r, 'homePhone'),
    workPhone: rowStr(r, 'workPhone'),
    email: rowStr(r, 'email'),
    isPrimary: rowStr(r, 'primaryContact').toLowerCase() === 'yes',
  }))
}

/**
 * Fetch an employee's compensation history (read-only, SENSITIVE) from the BambooHR
 * `compensation` table. The latest row is the current pay; earlier rows give effective
 * dates. Returns [] when the account exposes none.
 * @throws Error with a human-readable message on a hard failure.
 */
export async function fetchRrhhCompensation(
  subdomain: string,
  apiKey: string,
  employeeId: string,
): Promise<RrhhCompensationEntry[]> {
  const qs = new URLSearchParams({
    path: `/v1/employees/${employeeId}/tables/compensation`,
    subdomain,
    apiKey,
  })

  const res = await fetch(`/api/bamboohr?${qs.toString()}`)
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
    throw new Error(err.error ?? `BambooHR error ${res.status}`)
  }

  const data = (await res.json()) as RawTableRow[]
  const entries = (Array.isArray(data) ? data : []).map((r): RrhhCompensationEntry => {
    const { rate, currency } = parsePayRate(rowStr(r, 'rate'))
    return {
      id: String(r.id ?? ''),
      startDate: rowStr(r, 'startDate'),
      rate,
      currency,
      paidPer: rowStr(r, 'paidPer', 'paidPer'),
      type: rowStr(r, 'type'),
      reason: rowStr(r, 'reason'),
    }
  })
  // Newest first (most recent effective date is the current compensation).
  return entries.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
}

interface BambooFile {
  id?: string | number
  name?: string
  originalFileName?: string
  dateCreated?: string
  size?: string | number
  shareWithEmployee?: string | boolean
}
interface BambooFileCategory {
  name?: string
  files?: BambooFile[]
}
interface BambooFilesResponse {
  categories?: BambooFileCategory[]
}

/**
 * Fetch an employee's document metadata (read-only, SENSITIVE) from BambooHR
 * (GET /v1/employees/{id}/files/view). Only names/categories/dates are read — no file
 * contents are downloaded. Returns [] when the account exposes none.
 * @throws Error with a human-readable message on a hard failure.
 */
export async function fetchRrhhDocuments(
  subdomain: string,
  apiKey: string,
  employeeId: string,
): Promise<RrhhDocument[]> {
  const qs = new URLSearchParams({
    path: `/v1/employees/${employeeId}/files/view`,
    subdomain,
    apiKey,
  })

  const res = await fetch(`/api/bamboohr?${qs.toString()}`)
  if (!res.ok) {
    const err = (await res.json().catch(() => ({ error: 'Unknown error' }))) as { error?: string }
    throw new Error(err.error ?? `BambooHR error ${res.status}`)
  }

  const data = (await res.json()) as BambooFilesResponse
  const out: RrhhDocument[] = []
  for (const cat of data.categories ?? []) {
    for (const f of cat.files ?? []) {
      out.push({
        id: String(f.id ?? ''),
        name: f.name ?? f.originalFileName ?? '—',
        category: cat.name ?? '—',
        dateCreated: f.dateCreated ?? '',
        size: f.size != null ? String(f.size) : '',
        shareWithEmployee: f.shareWithEmployee === true || f.shareWithEmployee === 'yes',
      })
    }
  }
  return out
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
