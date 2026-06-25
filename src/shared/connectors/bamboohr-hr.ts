/**
 * Shared BambooHR "rich HR" connector.
 *
 * Fetches the extended employee fields (national id / cédula, address, phones, birth
 * date, etc.) that the base shared `Employee` type intentionally omits. Lives in the
 * shared layer (not inside a module) so any module — e.g. Documentos for contract
 * auto-fill — can pull them without violating module isolation (a module may not import
 * from another module, only from @/shared).
 *
 * All calls go through the /api/bamboohr proxy (CORS + server-side credential fallback),
 * exactly like the base directory fetch. Best-effort by field: BambooHR returns "" for
 * fields that are empty or that the API key cannot see.
 */

export interface HrEmployeeDetail {
  /** BambooHR employee id (matches the shared Employee.id). */
  id: string
  firstName: string
  lastName: string
  workEmail: string
  jobTitle: string
  department: string
  hireDate: string
  /** National id (cédula). BambooHR stores it in the SSN field for DR accounts. */
  nationalId: string
  address: string
  city: string
  state: string
  zipcode: string
  mobilePhone: string
  workPhone: string
  homePhone: string
  dateOfBirth: string
  gender: string
  maritalStatus: string
  nationality: string
  supervisor: string
  employeeNumber: string
}

interface BambooHrReportRow {
  id: string | number
  firstName?: string
  lastName?: string
  workEmail?: string
  jobTitle?: string
  department?: string
  hireDate?: string
  ssn?: string
  address1?: string
  address2?: string
  city?: string
  state?: string
  zipcode?: string
  mobilePhone?: string
  workPhone?: string
  homePhone?: string
  dateOfBirth?: string
  gender?: string
  maritalStatus?: string
  nationality?: string
  supervisor?: string
  employeeNumber?: string
}

interface BambooHrReportResponse {
  employees: BambooHrReportRow[]
}

const REPORT_FIELDS = [
  'id',
  'firstName',
  'lastName',
  'workEmail',
  'jobTitle',
  'department',
  'hireDate',
  'ssn',
  'address1',
  'address2',
  'city',
  'state',
  'zipcode',
  'mobilePhone',
  'workPhone',
  'homePhone',
  'dateOfBirth',
  'gender',
  'maritalStatus',
  'nationality',
  'supervisor',
  'employeeNumber',
]

function joinAddress(line1: string | undefined, line2: string | undefined): string {
  return [line1, line2].map((s) => (s ?? '').trim()).filter(Boolean).join(', ')
}

/**
 * Fetches the rich HR detail for every employee via a BambooHR custom report.
 * Returns an array keyed by `id` (string) — pair it with the shared Employee list by id.
 */
export async function fetchHrDirectory(
  subdomain: string,
  apiKey: string,
): Promise<HrEmployeeDetail[]> {
  const qs = new URLSearchParams({
    path: '/v1/reports/custom',
    subdomain,
    apiKey,
    format: 'JSON',
  })

  const res = await fetch(`/api/bamboohr?${qs.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: REPORT_FIELDS }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(err.error ?? `BambooHR error ${res.status}`)
  }

  const data = await res.json() as BambooHrReportResponse
  return (data.employees ?? []).map((e): HrEmployeeDetail => ({
    id: String(e.id),
    firstName: e.firstName ?? '',
    lastName: e.lastName ?? '',
    workEmail: e.workEmail ?? '',
    jobTitle: e.jobTitle ?? '',
    department: e.department ?? '',
    hireDate: e.hireDate ?? '',
    // BambooHR stores the national id (cédula) in the SSN field for DR accounts.
    nationalId: (e.ssn ?? '').trim(),
    address: joinAddress(e.address1, e.address2),
    city: e.city ?? '',
    state: e.state ?? '',
    zipcode: e.zipcode ?? '',
    mobilePhone: e.mobilePhone ?? '',
    workPhone: e.workPhone ?? '',
    homePhone: e.homePhone ?? '',
    dateOfBirth: e.dateOfBirth ?? '',
    gender: e.gender ?? '',
    maritalStatus: e.maritalStatus ?? '',
    nationality: e.nationality ?? '',
    supervisor: e.supervisor ?? '',
    employeeNumber: e.employeeNumber ?? '',
  }))
}

/** Convenience: index a fetched HR directory by employee id for O(1) lookup. */
export function indexHrById(rows: HrEmployeeDetail[]): Record<string, HrEmployeeDetail> {
  const out: Record<string, HrEmployeeDetail> = {}
  for (const r of rows) out[r.id] = r
  return out
}
