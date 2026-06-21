/**
 * RRHH (Human Resources) module types.
 *
 * These are HR-domain types, distinct from Nómina's payroll-focused `Employee`.
 * They are populated from BambooHR (read-only) via the module's own connector.
 */

export type RrhhEmployeeStatus = 'Active' | 'Inactive' | 'Terminated'

/** A single HR employee record, richer than the payroll `Employee`. */
export interface RrhhEmployee {
  id: string
  /** BambooHR human-facing employee number (distinct from the internal id). */
  employeeNumber: string
  firstName: string
  lastName: string
  preferredName: string
  displayName: string

  // Job
  jobTitle: string
  department: string
  division: string
  location: string
  hireDate: string
  status: RrhhEmployeeStatus
  /** Supervisor's display name, as reported by BambooHR. */
  supervisor: string
  /** Supervisor's BambooHR employee id — drives the org chart. '' if none. */
  supervisorId: string

  // Contact
  workEmail: string
  mobilePhone: string
  workPhone: string

  // Personal
  gender: string
  dateOfBirth: string
  maritalStatus: string
  nationality: string
  country: string
  city: string
  state: string
  address: string

  // Compensation (read-only display)
  payRate: number
  payRateCurrency: string
  payType: 'Hourly' | 'Salary' | ''

  /** BambooHR-hosted avatar URL, when available. */
  photoUrl: string
}

/** A department with its members, derived from the employee directory. */
export interface RrhhDepartment {
  name: string
  headcount: number
  divisions: string[]
  locations: string[]
  employees: RrhhEmployee[]
}

/** A node in the reporting hierarchy (org chart). */
export interface OrgNode {
  employee: RrhhEmployee
  reports: OrgNode[]
}

/**
 * A single approved time-off / PTO request (read-only) from BambooHR.
 * Mirrors the shape the `/v1/time_off/requests` proxy returns.
 */
export interface RrhhTimeOffRequest {
  id: string
  employeeId: string
  employeeName: string
  /** Time-off policy/type name, e.g. "Vacation", "Sick". */
  typeName: string
  typeId: string
  start: string            // YYYY-MM-DD
  end: string              // YYYY-MM-DD
  /** Number of days, from BambooHR `amount.amount`. */
  days: number
  status: string           // "approved" | "requested" | ...
}

/** Aggregated time-off totals for one employee in a given year. */
export interface RrhhTimeOffBalance {
  employeeId: string
  employeeName: string
  totalDays: number
  requestCount: number
  requests: RrhhTimeOffRequest[]
}
