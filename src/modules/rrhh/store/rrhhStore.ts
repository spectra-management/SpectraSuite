/**
 * RRHH module store (offline-first).
 *
 * Mirrors the Nómina `employeesStore` pattern: Zustand + the shared `storage`
 * abstraction (localStorage today, Supabase-ready) + a `lastSync` marker + a manual
 * sync action. Module-local on purpose — it is only imported within `modules/rrhh`,
 * so module isolation (IMPORT_RULES) holds.
 */

import { create } from 'zustand'
import { storage } from '@/shared/lib/storage'
import { fetchEmployeesCloud } from '@/shared/lib/cloudSync'
import type { CloudEmployee } from '@/shared/connectors/bamboohr-hr'
import type { RrhhEmployee, RrhhEmployeeStatus, RrhhTimeOffRequest } from '@/modules/rrhh/types'

const KEY_EMPLOYEES = 'rrhh_employees'
const KEY_TIMEOFF = 'rrhh_timeoff'
const KEY_LAST_SYNC = 'rrhh_last_sync'
const KEY_TIMEOFF_YEAR = 'rrhh_timeoff_year'

/** Map a DB-backed CloudEmployee onto the RRHH directory shape (fields the cloud lacks default empty). */
function toRrhhEmployee(c: CloudEmployee): RrhhEmployee {
  const status: RrhhEmployeeStatus =
    c.status === 'Inactive' ? 'Inactive' : c.status === 'Terminated' ? 'Terminated' : 'Active'
  return {
    id: c.id,
    employeeNumber: c.employeeNumber,
    firstName: c.firstName,
    lastName: c.lastName,
    preferredName: '',
    displayName: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.workEmail,
    jobTitle: c.jobTitle,
    department: c.department,
    division: c.division,
    location: [c.city, c.state].filter(Boolean).join(', '),
    hireDate: c.hireDate,
    status,
    supervisor: c.supervisor,
    supervisorId: '',
    workEmail: c.workEmail,
    personalEmail: '',
    mobilePhone: c.mobilePhone,
    workPhone: c.workPhone,
    homePhone: c.homePhone,
    gender: c.gender,
    dateOfBirth: c.dateOfBirth,
    maritalStatus: c.maritalStatus,
    nationality: c.nationality,
    country: c.country,
    city: c.city,
    state: c.state,
    address: c.address,
    address2: '',
    zipcode: c.zipcode,
    ssn: c.nationalId,
    payRate: c.payRate,
    payRateCurrency: c.payRateCurrency,
    payType: c.payType,
    payPer: '',
    paySchedule: '',
    payGroup: '',
    exempt: '',
    photoUrl: '',
  }
}

interface RrhhState {
  employees: RrhhEmployee[]
  timeOff: RrhhTimeOffRequest[]
  timeOffYear: number | null
  lastSync: string | null

  setEmployees: (employees: RrhhEmployee[]) => void
  setTimeOff: (requests: RrhhTimeOffRequest[], year: number) => void
  setLastSync: (iso: string) => void
  /** Load the directory from the DB (employees table) so a fresh device shows employees
   *  without a BambooHR sync. A richer locally-synced record wins per employee. */
  hydrateFromCloud: () => Promise<void>
}

export const useRrhhStore = create<RrhhState>((set, get) => ({
  employees: storage.get<RrhhEmployee[]>(KEY_EMPLOYEES) ?? [],
  timeOff: storage.get<RrhhTimeOffRequest[]>(KEY_TIMEOFF) ?? [],
  timeOffYear: storage.get<number>(KEY_TIMEOFF_YEAR),
  lastSync: storage.get<string>(KEY_LAST_SYNC),

  setEmployees: (employees) => {
    storage.set(KEY_EMPLOYEES, employees)
    set({ employees })
  },

  setTimeOff: (requests, year) => {
    storage.set(KEY_TIMEOFF, requests)
    storage.set(KEY_TIMEOFF_YEAR, year)
    set({ timeOff: requests, timeOffYear: year })
  },

  setLastSync: (iso) => {
    storage.set(KEY_LAST_SYNC, iso)
    set({ lastSync: iso })
  },

  hydrateFromCloud: async () => {
    const cloud = await fetchEmployeesCloud()
    if (cloud.length === 0) return // unreachable / not permitted / empty — keep local cache
    // A locally-synced record (richer: supervisorId, preferred name, photo, etc.) wins;
    // the cloud fills in employees this device hasn't synced yet.
    const localById = Object.fromEntries(get().employees.map((e) => [e.id, e]))
    const merged = cloud.map((c) => localById[c.id] ?? toRrhhEmployee(c))
    storage.set(KEY_EMPLOYEES, merged)
    set({ employees: merged })
  },
}))
