import type { BambooDirectoryResponse } from './types'
import type { Employee } from '@/types'

function buildUrl(path: string, subdomain: string, apiKey: string): string {
  return `/api/bamboohr?path=${encodeURIComponent(path)}&subdomain=${encodeURIComponent(subdomain)}&apiKey=${encodeURIComponent(apiKey)}`
}

export async function fetchBambooDirectory(
  subdomain: string,
  apiKey: string,
): Promise<Employee[]> {
  const res = await fetch(buildUrl('/v1/employees/directory', subdomain, apiKey))
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(err.error ?? `BambooHR error ${res.status}`)
  }
  const data = await res.json() as BambooDirectoryResponse
  return data.employees.map((e) => ({
    id: e.id,
    firstName: e.firstName ?? '',
    lastName: e.lastName ?? '',
    workEmail: e.workEmail ?? '',
    payRate: parseFloat(e.payRate ?? '0') || 0,
    payType: (e.payType === 'Hourly' ? 'Hourly' : 'Salary') as Employee['payType'],
    jobTitle: e.jobTitle ?? '',
    department: e.department ?? '',
    hireDate: e.hireDate ?? '',
    status: mapStatus(e.status),
    customDeductions: [],
  }))
}

function mapStatus(status: string): Employee['status'] {
  const s = (status ?? '').toLowerCase()
  if (s === 'active') return 'Active'
  if (s === 'terminated') return 'Terminated'
  return 'Inactive'
}
