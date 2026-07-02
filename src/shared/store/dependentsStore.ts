import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { saveAppState, fetchAppState } from '@/shared/lib/cloudSync'
import type { InsuranceDependent } from '@/shared/types'

/**
 * Per-employee insurance dependents, mirroring the accounting report
 * "Detalle dependientes adicionales" (sheets: "Detalle dependientes TSS" and
 * "Seguro Complementario"). Edited in RRHH; read by Nómina, where the per-coverage
 * monthly cost totals become the auto "Dependent TSS" / "Complementary Insurance"
 * deductions (see modules/nomina/lib/payroll/dependentDeductions.ts).
 * App-local — never written to BambooHR. Offline-first: localStorage cache +
 * Supabase app_state read back on login.
 */

type DependentsMap = Record<string, InsuranceDependent[]>

interface DependentsState {
  byEmployee: DependentsMap
  hydrated: boolean
  get: (employeeId: string) => InsuranceDependent[]
  addDependent: (employeeId: string, dep: Omit<InsuranceDependent, 'id'>) => void
  updateDependent: (employeeId: string, id: string, dep: Partial<InsuranceDependent>) => void
  removeDependent: (employeeId: string, id: string) => void
  hydrateFromCloud: () => Promise<void>
}

function persist(byEmployee: DependentsMap) {
  storage.set(STORAGE_KEYS.INSURANCE_DEPENDENTS, byEmployee)
  void saveAppState(STORAGE_KEYS.INSURANCE_DEPENDENTS, byEmployee)
}

export const useDependentsStore = create<DependentsState>((set, get) => ({
  byEmployee: storage.get<DependentsMap>(STORAGE_KEYS.INSURANCE_DEPENDENTS) ?? {},
  hydrated: false,

  get: (employeeId) => get().byEmployee[employeeId] ?? [],

  addDependent: (employeeId, dep) => {
    const cur = get().byEmployee[employeeId] ?? []
    const newDep: InsuranceDependent = { ...dep, id: crypto.randomUUID() }
    const byEmployee = { ...get().byEmployee, [employeeId]: [...cur, newDep] }
    set({ byEmployee })
    persist(byEmployee)
  },

  updateDependent: (employeeId, id, dep) => {
    const cur = get().byEmployee[employeeId] ?? []
    const byEmployee = {
      ...get().byEmployee,
      [employeeId]: cur.map((d) => (d.id === id ? { ...d, ...dep } : d)),
    }
    set({ byEmployee })
    persist(byEmployee)
  },

  removeDependent: (employeeId, id) => {
    const cur = get().byEmployee[employeeId] ?? []
    const byEmployee = { ...get().byEmployee, [employeeId]: cur.filter((d) => d.id !== id) }
    set({ byEmployee })
    persist(byEmployee)
  },

  hydrateFromCloud: async () => {
    const cloud = await fetchAppState<DependentsMap>(STORAGE_KEYS.INSURANCE_DEPENDENTS)
    if (cloud) {
      storage.set(STORAGE_KEYS.INSURANCE_DEPENDENTS, cloud)
      set({ byEmployee: cloud, hydrated: true })
    } else {
      set({ hydrated: true })
    }
  },
}))
