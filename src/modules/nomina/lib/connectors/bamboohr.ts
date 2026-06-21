import type { Employee } from '@/shared/types'

interface BambooReportEmployee {
  id: string | number
  firstName?: string
  lastName?: string
  workEmail?: string
  payRate?: string
  payType?: string  // "Hourly" | "Salary" | "Hourly Non-Exempt" | ...
  payPer?: string   // "Hour" | "Year" | "Month" | ... (fallback when payType absent)
  hireDate?: string
  employmentHistoryStatus?: string
  jobTitle?: string
  department?: string
  country?: string
}

interface BambooReportResponse {
  employees: BambooReportEmployee[]
}

/**
 * Maps BambooHR payType / payPer fields to 'Hourly' | 'Salary'.
 * payType values: "Hourly", "Hourly Non-Exempt", "Salary", "Salaried" …
 * payPer values:  "Hour", "Week", "Biweek", "Month", "Year" …
 */
function mapPayType(
  payType: string | null | undefined,
  payPer: string | null | undefined,
): Employee['payType'] {
  const pt = (payType ?? '').trim().toLowerCase()
  if (pt.startsWith('hourly')) return 'Hourly'
  if (pt === 'salary' || pt === 'salaried') return 'Salary'

  // Fallback: use payPer when payType is empty / not recognised
  const pp = (payPer ?? '').trim().toLowerCase()
  if (pp === 'hour') return 'Hourly'

  return 'Salary'   // conservative default
}

/**
 * Parses BambooHR payRate string ("15.00 USD", "850.00 DOP", "").
 * Returns { rate, currency } where currency is "" when not configured.
 */
function parsePayRate(raw: string | null | undefined): { rate: number; currency: string } {
  if (!raw || !raw.trim()) return { rate: 0, currency: '' }
  const parts = raw.trim().split(' ')
  const rate = parseFloat(parts[0] ?? '0') || 0
  const currency = parts[1] ?? ''
  return { rate, currency }
}

function mapStatus(raw: string | null | undefined): Employee['status'] {
  const s = (raw ?? '').toLowerCase().trim()
  if (s === 'active') return 'Active'
  if (s === 'terminated') return 'Terminated'
  if (s === 'inactive') return 'Inactive'
  // Default: if no status in the report, assume Active (they're in the system)
  return 'Active'
}

export async function fetchBambooDirectory(
  subdomain: string,
  apiKey: string,
): Promise<Employee[]> {
  // Use custom report to get payRate, hireDate, and employmentHistoryStatus
  // which are NOT available via the /employees/directory endpoint
  const qs = new URLSearchParams({
    path: '/v1/reports/custom',
    subdomain,
    apiKey,
    format: 'JSON',
  })

  const res = await fetch(`/api/bamboohr?${qs.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: [
        'id',
        'firstName',
        'lastName',
        'workEmail',
        'payRate',
        'payType',
        'payPer',
        'hireDate',
        'employmentHistoryStatus',
        'jobTitle',
        'department',
        'country',
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(err.error ?? `BambooHR error ${res.status}`)
  }

  const data = await res.json() as BambooReportResponse

  const employees = (data.employees ?? []).map((e): Employee => {
    const { rate, currency } = parsePayRate(e.payRate)
    return {
      id: String(e.id),
      firstName: e.firstName ?? '',
      lastName: e.lastName ?? '',
      workEmail: e.workEmail ?? '',
      payRate: rate,
      payRateCurrency: currency,
      payType: mapPayType(e.payType, e.payPer),
      jobTitle: e.jobTitle ?? '',
      department: e.department ?? '',
      hireDate: e.hireDate ?? '',
      status: mapStatus(e.employmentHistoryStatus),
      customDeductions: [],
      country: e.country ?? '',
      // New employees default to active in payroll. On re-sync, the caller
      // (Employees handleSync) preserves the existing override for known employees.
      payroll_active: true,
    }
  })

  return employees
}
