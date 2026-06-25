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

/**
 * The durable, cloud-persisted employee record: the rich HR detail plus the few base
 * payroll fields a document might need (salary, status, country). This is what the
 * `public.employees` table stores and what the Documentos module reads back — so it
 * works regardless of whether BambooHR is currently connected.
 */
export interface CloudEmployee extends HrEmployeeDetail {
  payRate: number
  payRateCurrency: string
  payType: 'Hourly' | 'Salary'
  status: string
  country: string
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

// In the Dominican Republic the national id (cédula) is usually a CUSTOM BambooHR field,
// not the standard `ssn` (which is empty). We find it two ways, both account-agnostic:
//   1. by VALUE — any field whose value has the DR cédula shape (11 digits, 000-0000000-0);
//   2. by NAME  — a field labelled cédula / identidad / documento / national id.
// Value-detection is primary because it works no matter how the field is named or keyed.
const CEDULA_FIELD_RE = /c[eé]dula|identidad|documento|national\s*id|nationalid|\bnin\b/i
const CEDULA_VALUE_RE = /^\d{3}-?\d{7}-?\d$/

interface FieldHints {
  /** Custom/text field ids to additionally request so their values can be scanned. */
  textFieldIds: string[]
  /** A field id/alias whose label looks like a national id, if any. */
  namedCedulaId: string | null
}

/** Reads /v1/meta/fields to learn which extra fields to request + a name-matched candidate. */
async function fetchFieldHints(subdomain: string, apiKey: string): Promise<FieldHints> {
  try {
    const qs = new URLSearchParams({ path: '/v1/meta/fields', subdomain, apiKey })
    const res = await fetch(`/api/bamboohr?${qs.toString()}`)
    if (!res.ok) return { textFieldIds: [], namedCedulaId: null }
    const fields = (await res.json()) as Array<{ id?: string | number; name?: string; alias?: string; type?: string }>
    if (!Array.isArray(fields)) return { textFieldIds: [], namedCedulaId: null }
    // Request EVERY field by id (BambooHR ignores ones it doesn't recognise). This guarantees
    // a custom field like "Cedula" is returned so the value scan can find it, no matter its type.
    const textFieldIds = fields.filter((f) => f.id != null).map((f) => String(f.id))
    const named = fields.find((f) => CEDULA_FIELD_RE.test(`${f.name ?? ''} ${f.alias ?? ''}`))
    const namedCedulaId = named ? (named.alias ? String(named.alias) : String(named.id)) : null
    return { textFieldIds, namedCedulaId }
  } catch {
    return { textFieldIds: [], namedCedulaId: null }
  }
}

/** First value in the row that has the DR cédula shape. "" if none. */
export function findCedulaByValue(row: Record<string, unknown>): string {
  for (const v of Object.values(row)) {
    if (typeof v === 'string' && CEDULA_VALUE_RE.test(v.trim())) return v.trim()
  }
  return ''
}

/**
 * Fetches the rich HR detail for every employee via a BambooHR custom report.
 * Returns an array keyed by `id` (string) — pair it with the shared Employee list by id.
 */
export async function fetchHrDirectory(
  subdomain: string,
  apiKey: string,
): Promise<HrEmployeeDetail[]> {
  // Learn this account's fields so we can request the cédula (a custom field) and scan for it.
  const hints = await fetchFieldHints(subdomain, apiKey)
  const requestFields = Array.from(new Set([
    ...REPORT_FIELDS,
    ...hints.textFieldIds,
    ...(hints.namedCedulaId ? [hints.namedCedulaId] : []),
  ]))

  const qs = new URLSearchParams({
    path: '/v1/reports/custom',
    subdomain,
    apiKey,
    format: 'JSON',
  })

  const res = await fetch(`/api/bamboohr?${qs.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: requestFields }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(err.error ?? `BambooHR error ${res.status}`)
  }

  const data = await res.json() as BambooHrReportResponse
  return (data.employees ?? []).map((e): HrEmployeeDetail => {
    const row = e as unknown as Record<string, unknown>
    // Cédula: prefer the name-matched field, else any field whose value looks like a
    // cédula, else the standard SSN field.
    const named = hints.namedCedulaId ? String(row[hints.namedCedulaId] ?? '').trim() : ''
    const detected = named || findCedulaByValue(row)
    return {
    id: String(e.id),
    firstName: e.firstName ?? '',
    lastName: e.lastName ?? '',
    workEmail: e.workEmail ?? '',
    jobTitle: e.jobTitle ?? '',
    department: e.department ?? '',
    hireDate: e.hireDate ?? '',
    // Prefer the detected DR cédula custom field; fall back to the standard SSN field.
    nationalId: detected || (e.ssn ?? '').trim(),
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
    }
  })
}

/** Convenience: index a fetched HR directory by employee id for O(1) lookup. */
export function indexHrById(rows: HrEmployeeDetail[]): Record<string, HrEmployeeDetail> {
  const out: Record<string, HrEmployeeDetail> = {}
  for (const r of rows) out[r.id] = r
  return out
}

/** Combine a base payroll Employee with its (optional) rich HR detail into a CloudEmployee. */
export function toCloudEmployee(base: BaseEmployeeFields, hr: HrEmployeeDetail | undefined): CloudEmployee {
  return {
    id: base.id,
    firstName: base.firstName,
    lastName: base.lastName,
    workEmail: base.workEmail,
    jobTitle: base.jobTitle,
    department: base.department,
    hireDate: base.hireDate,
    nationalId: hr?.nationalId ?? '',
    address: hr?.address ?? '',
    city: hr?.city ?? '',
    state: hr?.state ?? '',
    zipcode: hr?.zipcode ?? '',
    mobilePhone: hr?.mobilePhone ?? '',
    workPhone: hr?.workPhone ?? '',
    homePhone: hr?.homePhone ?? '',
    dateOfBirth: hr?.dateOfBirth ?? '',
    gender: hr?.gender ?? '',
    maritalStatus: hr?.maritalStatus ?? '',
    nationality: hr?.nationality ?? '',
    supervisor: hr?.supervisor ?? '',
    employeeNumber: hr?.employeeNumber ?? '',
    payRate: base.payRate,
    payRateCurrency: base.payRateCurrency ?? '',
    payType: base.payType,
    status: base.status,
    country: base.country ?? '',
  }
}

/** The base payroll fields toCloudEmployee needs (a structural subset of Employee). */
export interface BaseEmployeeFields {
  id: string
  firstName: string
  lastName: string
  workEmail: string
  jobTitle: string
  department: string
  hireDate: string
  payRate: number
  payRateCurrency?: string
  payType: 'Hourly' | 'Salary'
  status: string
  country?: string
}
