import { describe, it, expect } from 'vitest'
import { buildDepartments, buildOrgChart, countReports, buildTimeOffBalances } from '../derive'
import { tenureFrom } from '../format'
import type { RrhhEmployee, RrhhTimeOffRequest } from '@/modules/rrhh/types'

function emp(over: Partial<RrhhEmployee> & { id: string }): RrhhEmployee {
  return {
    employeeNumber: '',
    firstName: 'First',
    lastName: over.id,
    preferredName: '',
    displayName: `First ${over.id}`,
    jobTitle: '',
    department: '',
    division: '',
    location: '',
    hireDate: '',
    status: 'Active',
    supervisor: '',
    supervisorId: '',
    workEmail: '',
    mobilePhone: '',
    workPhone: '',
    gender: '',
    dateOfBirth: '',
    maritalStatus: '',
    nationality: '',
    country: '',
    city: '',
    state: '',
    address: '',
    payRate: 0,
    payRateCurrency: '',
    payType: '',
    photoUrl: '',
    ...over,
  }
}

describe('buildDepartments', () => {
  it('groups by department, counts headcount, and buckets unassigned', () => {
    const employees = [
      emp({ id: '1', department: 'Engineering', division: 'Platform', location: 'SD' }),
      emp({ id: '2', department: 'Engineering', division: 'Apps', location: 'SD' }),
      emp({ id: '3', department: 'Sales', location: 'NY' }),
      emp({ id: '4', department: '' }),
    ]
    const depts = buildDepartments(employees)
    const eng = depts.find((d) => d.name === 'Engineering')!
    expect(eng.headcount).toBe(2)
    expect(eng.divisions).toEqual(['Apps', 'Platform'])
    expect(depts.find((d) => d.name === 'Unassigned')!.headcount).toBe(1)
    // sorted by headcount desc — Engineering first
    expect(depts[0].name).toBe('Engineering')
  })
})

describe('buildOrgChart', () => {
  it('nests reports under their supervisor and finds roots', () => {
    const employees = [
      emp({ id: 'ceo' }),
      emp({ id: 'vp', supervisorId: 'ceo' }),
      emp({ id: 'ic', supervisorId: 'vp' }),
    ]
    const roots = buildOrgChart(employees)
    expect(roots).toHaveLength(1)
    expect(roots[0].employee.id).toBe('ceo')
    expect(roots[0].reports[0].employee.id).toBe('vp')
    expect(countReports(roots[0])).toBe(2)
  })

  it('treats a missing supervisor as a root', () => {
    const employees = [emp({ id: 'a', supervisorId: 'ghost' })]
    const roots = buildOrgChart(employees)
    expect(roots).toHaveLength(1)
    expect(roots[0].employee.id).toBe('a')
  })

  it('does not infinite-loop on a supervisor cycle', () => {
    const employees = [
      emp({ id: 'a', supervisorId: 'b' }),
      emp({ id: 'b', supervisorId: 'a' }),
    ]
    // Both have a present supervisor, so neither is a natural root → no roots, but the
    // call must terminate rather than hang.
    const roots = buildOrgChart(employees)
    expect(Array.isArray(roots)).toBe(true)
  })

  it('ignores an employee who is their own supervisor (self-loop becomes a root)', () => {
    const employees = [emp({ id: 'a', supervisorId: 'a' })]
    const roots = buildOrgChart(employees)
    expect(roots).toHaveLength(1)
    expect(roots[0].reports).toHaveLength(0)
  })
})

describe('buildTimeOffBalances', () => {
  const req = (over: Partial<RrhhTimeOffRequest> & { id: string; employeeId: string }): RrhhTimeOffRequest => ({
    employeeName: '',
    typeName: 'Vacation',
    typeId: '83',
    start: '2026-01-01',
    end: '2026-01-02',
    days: 1,
    status: 'approved',
    ...over,
  })

  it('aggregates days and request counts per employee, resolving names', () => {
    const employees = [emp({ id: '1', displayName: 'Ana Pérez' })]
    const requests = [
      req({ id: 'r1', employeeId: '1', days: 3 }),
      req({ id: 'r2', employeeId: '1', days: 2 }),
      req({ id: 'r3', employeeId: '2', days: 5, employeeName: 'Beto' }),
    ]
    const balances = buildTimeOffBalances(requests, employees)
    expect(balances[0].employeeId).toBe('1') // highest total first (5)
    expect(balances[0].totalDays).toBe(5)
    expect(balances[0].requestCount).toBe(2)
    expect(balances[0].employeeName).toBe('Ana Pérez')
    const beto = balances.find((b) => b.employeeId === '2')!
    expect(beto.employeeName).toBe('Beto') // falls back to the request's name
  })
})

describe('tenureFrom', () => {
  it('computes whole years and remaining months', () => {
    const now = new Date('2026-06-20T00:00:00')
    expect(tenureFrom('2023-04-20', now)).toEqual({ years: 3, months: 2 })
  })

  it('returns null for empty or future hire dates', () => {
    const now = new Date('2026-06-20T00:00:00')
    expect(tenureFrom('', now)).toBeNull()
    expect(tenureFrom('2030-01-01', now)).toBeNull()
  })
})
