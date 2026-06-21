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
  personalEmail: string
  mobilePhone: string
  workPhone: string
  homePhone: string

  // Personal
  gender: string
  dateOfBirth: string
  maritalStatus: string
  nationality: string
  country: string
  city: string
  state: string
  address: string
  address2: string
  zipcode: string
  /** National ID / SSN (sensitive — masked unless the viewer has elevated access). */
  ssn: string

  // Compensation (read-only display — sensitive)
  payRate: number
  payRateCurrency: string
  payType: 'Hourly' | 'Salary' | ''
  /** Pay frequency, e.g. "Hour", "Year", "Month" (BambooHR `payPer`). */
  payPer: string
  /** Pay schedule name, e.g. "Bi-weekly". */
  paySchedule: string
  payGroup: string
  /** FLSA exemption status, e.g. "Exempt" / "Non-exempt". */
  exempt: string

  /** BambooHR-hosted avatar URL, when available. */
  photoUrl: string
}

/**
 * A single emergency contact (read-only) from BambooHR
 * (GET /v1/employees/{id}/tables/emergencyContacts).
 */
export interface RrhhEmergencyContact {
  id: string
  name: string
  relationship: string
  mobilePhone: string
  homePhone: string
  workPhone: string
  email: string
  /** Whether BambooHR flags this as the primary contact. */
  isPrimary: boolean
}

/**
 * A compensation history row (read-only, sensitive) from BambooHR
 * (GET /v1/employees/{id}/tables/compensation).
 */
export interface RrhhCompensationEntry {
  id: string
  /** Effective date (YYYY-MM-DD). */
  startDate: string
  rate: number
  currency: string
  /** Pay frequency, e.g. "Hour", "Year". */
  paidPer: string
  type: string
  reason: string
}

/**
 * An employee document (read-only metadata, sensitive) from BambooHR
 * (GET /v1/employees/{id}/files/view). No file contents are downloaded.
 */
export interface RrhhDocument {
  id: string
  name: string
  /** Category/folder name the file lives under in BambooHR. */
  category: string
  /** ISO date the file was created/uploaded, if provided. */
  dateCreated: string
  /** File size as reported by BambooHR (already human-formatted, e.g. "12 KB"). */
  size: string
  /** True if BambooHR shares this file with the employee. */
  shareWithEmployee: boolean
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
