import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import type { Employee, CustomDeduction } from '@/shared/types'
import { generateId } from '@/shared/lib/utils'

interface EmployeesState {
  employees: Employee[]
  lastSync: string | null
  setEmployees: (employees: Employee[]) => void
  updateEmployee: (id: string, data: Partial<Employee>) => void
  addDeduction: (employeeId: string, deduction: Omit<CustomDeduction, 'id'>) => void
  updateDeduction: (employeeId: string, deductionId: string, data: Partial<CustomDeduction>) => void
  removeDeduction: (employeeId: string, deductionId: string) => void
  setLastSync: (date: string) => void
}

export const useEmployeesStore = create<EmployeesState>((set, get) => ({
  employees: storage.get<Employee[]>(STORAGE_KEYS.EMPLOYEES) ?? [],
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
}))
