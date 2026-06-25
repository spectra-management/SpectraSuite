import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { fetchEmployeesCloud, saveEmployeesCloud } from '@/shared/lib/cloudSync'
import type { CloudEmployee } from '@/shared/connectors/bamboohr-hr'

/**
 * Durable, cloud-backed employee directory with rich HR detail (cédula, address, phone,
 * DOB…). This is the source the Documentos module reads so it can fill documents from the
 * database regardless of whether BambooHR is currently connected.
 *
 * Offline-first cloud-authoritative: localStorage is the fast cache, Supabase
 * (public.employees, migration 012) is the durable source read back on login. A BambooHR
 * sync (Nómina Employees page) calls setFromSync() to refresh + push the latest up.
 */
interface EmployeeHrState {
  byId: Record<string, CloudEmployee>
  getEmployee: (id: string) => CloudEmployee | undefined
  /** Called after a BambooHR sync: replace local copy + push to the cloud. */
  setFromSync: (employees: CloudEmployee[]) => void
  /** Read the directory back from the cloud (best-effort, offline-safe). */
  hydrateFromCloud: () => Promise<void>
}

function indexById(list: CloudEmployee[]): Record<string, CloudEmployee> {
  const out: Record<string, CloudEmployee> = {}
  for (const e of list) out[e.id] = e
  return out
}

export const useEmployeeHrStore = create<EmployeeHrState>((set, get) => ({
  byId: storage.get<Record<string, CloudEmployee>>(STORAGE_KEYS.EMPLOYEES_HR) ?? {},

  getEmployee: (id) => get().byId[id],

  setFromSync: (employees) => {
    const byId = indexById(employees)
    storage.set(STORAGE_KEYS.EMPLOYEES_HR, byId)
    set({ byId })
    void saveEmployeesCloud(employees) // best-effort durable mirror
  },

  hydrateFromCloud: async () => {
    const cloud = await fetchEmployeesCloud()
    if (cloud.length === 0) return // unreachable / not permitted / empty — keep local cache
    const byId = indexById(cloud)
    storage.set(STORAGE_KEYS.EMPLOYEES_HR, byId)
    set({ byId })
  },
}))
