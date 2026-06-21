/**
 * Pure derivations over the RRHH employee directory: departments and the org chart.
 * No React / UI dependencies.
 */

import type {
  RrhhEmployee,
  RrhhDepartment,
  OrgNode,
  RrhhTimeOffRequest,
  RrhhTimeOffBalance,
} from '@/modules/rrhh/types'

const UNASSIGNED = 'Unassigned'

/** Group employees into departments with headcount, divisions and locations. */
export function buildDepartments(employees: RrhhEmployee[]): RrhhDepartment[] {
  const map = new Map<string, RrhhEmployee[]>()
  for (const e of employees) {
    const dept = e.department.trim() || UNASSIGNED
    const list = map.get(dept) ?? []
    list.push(e)
    map.set(dept, list)
  }

  return [...map.entries()]
    .map(([name, list]): RrhhDepartment => ({
      name,
      headcount: list.length,
      divisions: [...new Set(list.map((e) => e.division).filter(Boolean))].sort(),
      locations: [...new Set(list.map((e) => e.location).filter(Boolean))].sort(),
      employees: [...list].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    }))
    .sort((a, b) => b.headcount - a.headcount || a.name.localeCompare(b.name))
}

/**
 * Build the reporting hierarchy (forest of roots). A root is an employee with no
 * supervisor, or whose supervisor id is not present in the directory. Cycles are
 * guarded against so a malformed chain can't infinite-loop.
 */
export function buildOrgChart(employees: RrhhEmployee[]): OrgNode[] {
  const byId = new Map<string, RrhhEmployee>()
  for (const e of employees) byId.set(e.id, e)

  const childrenOf = new Map<string, RrhhEmployee[]>()
  const roots: RrhhEmployee[] = []

  for (const e of employees) {
    const supId = e.supervisorId
    if (supId && byId.has(supId) && supId !== e.id) {
      const arr = childrenOf.get(supId) ?? []
      arr.push(e)
      childrenOf.set(supId, arr)
    } else {
      roots.push(e)
    }
  }

  const sortByName = (a: RrhhEmployee, b: RrhhEmployee) => a.displayName.localeCompare(b.displayName)

  const build = (emp: RrhhEmployee, seen: Set<string>): OrgNode => {
    seen.add(emp.id)
    const kids = (childrenOf.get(emp.id) ?? [])
      .filter((c) => !seen.has(c.id))
      .sort(sortByName)
    return { employee: emp, reports: kids.map((c) => build(c, new Set(seen))) }
  }

  return roots.sort(sortByName).map((r) => build(r, new Set()))
}

/** Count direct + indirect reports under a node. */
export function countReports(node: OrgNode): number {
  return node.reports.reduce((sum, child) => sum + 1 + countReports(child), 0)
}

/** Aggregate time-off requests into per-employee balances. */
export function buildTimeOffBalances(
  requests: RrhhTimeOffRequest[],
  employees: RrhhEmployee[],
): RrhhTimeOffBalance[] {
  const nameById = new Map(employees.map((e) => [e.id, e.displayName]))
  const map = new Map<string, RrhhTimeOffBalance>()

  for (const r of requests) {
    const existing = map.get(r.employeeId)
    if (existing) {
      existing.totalDays += r.days
      existing.requestCount += 1
      existing.requests.push(r)
    } else {
      map.set(r.employeeId, {
        employeeId: r.employeeId,
        employeeName: nameById.get(r.employeeId) || r.employeeName || r.employeeId,
        totalDays: r.days,
        requestCount: 1,
        requests: [r],
      })
    }
  }

  for (const bal of map.values()) {
    bal.requests.sort((a, b) => (b.start || '').localeCompare(a.start || ''))
  }

  return [...map.values()].sort((a, b) => b.totalDays - a.totalDays)
}
