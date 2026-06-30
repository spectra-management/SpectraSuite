import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import type { Employee, CustomDeduction } from '@/shared/types'
import { generateId } from '@/shared/lib/utils'
import { fetchEmployeesCloud } from '@/shared/lib/cloudSync'
import type { CloudEmployee } from '@/shared/connectors/bamboohr-hr'

/** Map a DB-backed CloudEmployee onto the Nómina Employee shape. */
function toEmployee(c: CloudEmployee): Employee {
  const status: Employee['status'] =
    c.status === 'Inactive' ? 'Inactive' : c.status === 'Terminated' ? 'Terminated' : 'Active'
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    workEmail: c.workEmail,
    payRate: c.payRate,
    payRateCurrency: c.payRateCurrency,
    payType: c.payType,
    jobTitle: c.jobTitle,
    department: c.department,
    hireDate: c.hireDate,
    status,
    country: c.country,
    payroll_active: true,
  }
}

/** Keep Spectra-local operational fields (not stored in the cloud roster) on re-hydrate. */
function mergeLocal(fresh: Employee, old: Employee | undefined): Employee {
  if (!old) return fresh
  return {
    ...fresh,
    customDeductions: old.customDeductions,
    hubstaffUserId: old.hubstaffUserId,
    payroll_active: old.payroll_active,
  }
}

interface EmployeesState {
  employees: Employee[]
  lastSync: string | null
  setEmployees: (employees: Employee[]) => void
  updateEmployee: (id: string, data: Partial<Employee>) => void
  addDeduction: (employeeId: string, deduction: Omit<CustomDeduction, 'id'>) => void
  updateDeduction: (employeeId: string, deductionId: string, data: Partial<CustomDeduction>) => void
  removeDeduction: (employeeId: string, deductionId: string) => void
  setLastSync: (date: string) => void
  /** Load the roster from the DB (employees table) on login, so a fresh device shows
   *  employees without needing a BambooHR sync. Local-only fields are preserved. */
  hydrateFromCloud: () => Promise<void>
}

export const useEmployeesStore = create<EmployeesState>((set, get) => ({
  // Normalize legacy records persisted before payroll_active existed: a missing
  // value means "active in payroll" (the default).
  employees: (storage.get<Employee[]>(STORAGE_KEYS.EMPLOYEES) ?? []).map((e) => ({
    ...e,
    payroll_active: e.payroll_active !== false,
  })),
  lastSync: null,

  setEmployees: (employees) => {
    storage.set(STORAGE_KEYS.EMPLOYEES, employees)
    set({ employees })
  },

  updateEmployee: (id, data) => {
    const employees = get().employees.map((e) => (e.id === id ? { ...e, ...data } : e))
    storage.set(STORAGE_KEYS.EMPLOYEES, employees)
    set({ employees })
  },

  addDeduction: (employeeId, deduction) => {
    const newDeduction: CustomDeduction = { ...deduction, id: generateId() }
    const employees = get().employees.map((e) => {
      if (e.id !== employeeId) return e
      return { ...e, customDeductions: [...(e.customDeductions ?? []), newDeduction] }
    })
    storage.set(STORAGE_KEYS.EMPLOYEES, employees)
    set({ employees })
  },

  updateDeduction: (employeeId, deductionId, data) => {
    const employees = get().employees.map((e) => {
      if (e.id !== employeeId) return e
      const deductions = (e.customDeductions ?? []).map((d) =>
        d.id === deductionId ? { ...d, ...data } : d,
      )
      return { ...e, customDeductions: deductions }
    })
    storage.set(STORAGE_KEYS.EMPLOYEES, employees)
    set({ employees })
  },

  removeDeduction: (employeeId, deductionId) => {
    const employees = get().employees.map((e) => {
      if (e.id !== employeeId) return e
      return {
        ...e,
        customDeductions: (e.customDeductions ?? []).filter((d) => d.id !== deductionId),
      }
    })
    storage.set(STORAGE_KEYS.EMPLOYEES, employees)
    set({ employees })
  },

  setLastSync: (date) => set({ lastSync: date }),

  hydrateFromCloud: async () => {
    const cloud = await fetchEmployeesCloud()
    if (cloud.length === 0) return // unreachable / not permitted / empty — keep local cache
    const prevById = Object.fromEntries(get().employees.map((e) => [e.id, e]))
    const merged = cloud.map((c) => mergeLocal(toEmployee(c), prevById[c.id]))
      .map((e) => ({ ...e, payroll_active: e.payroll_active !== false }))
    storage.set(STORAGE_KEYS.EMPLOYEES, merged)
    set({ employees: merged })
  },
}))
