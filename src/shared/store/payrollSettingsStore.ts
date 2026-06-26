import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import {
  fetchPayrollSettings,
  savePayrollSetting,
  type PayrollSetting,
} from '@/shared/lib/cloudSync'

/**
 * Per-employee payroll overrides (currently: tax exemption), keyed by employee id.
 *
 * App-local data shared across modules: both the Nómina and RRHH employee profiles edit it,
 * and the payroll engine reads it when a run is calculated. Offline-first cloud-authoritative:
 * localStorage is the fast cache, Supabase (employee_payroll_settings, migration 014) is the
 * durable source read back on login.
 */
interface PayrollSettingsState {
  byId: Record<string, PayrollSetting>
  /** Setting for an employee, or the safe default (not exempt). */
  get: (employeeId: string) => PayrollSetting
  /** True when the employee is flagged tax-exempt. */
  isTaxExempt: (employeeId: string) => boolean
  /** Set the tax-exemption flag + reason for an employee (persists locally + to the cloud). */
  setTaxExempt: (employeeId: string, taxExempt: boolean, reason: string) => void
  /** Read the settings back from the cloud (best-effort, offline-safe). */
  hydrateFromCloud: () => Promise<void>
}

const DEFAULT_SETTING: PayrollSetting = { taxExempt: false, taxExemptReason: '' }

export const usePayrollSettingsStore = create<PayrollSettingsState>((set, get) => ({
  byId: storage.get<Record<string, PayrollSetting>>(STORAGE_KEYS.EMPLOYEE_PAYROLL_SETTINGS) ?? {},

  get: (employeeId) => get().byId[employeeId] ?? DEFAULT_SETTING,

  isTaxExempt: (employeeId) => get().byId[employeeId]?.taxExempt === true,

  setTaxExempt: (employeeId, taxExempt, reason) => {
    // A reason is only meaningful while exempt; clear it when the flag is turned off.
    const setting: PayrollSetting = { taxExempt, taxExemptReason: taxExempt ? reason : '' }
    const byId = { ...get().byId, [employeeId]: setting }
    storage.set(STORAGE_KEYS.EMPLOYEE_PAYROLL_SETTINGS, byId)
    set({ byId })
    void savePayrollSetting(employeeId, setting)
  },

  hydrateFromCloud: async () => {
    const cloud = await fetchPayrollSettings()
    if (Object.keys(cloud).length === 0) return // unreachable / not permitted / empty — keep cache
    storage.set(STORAGE_KEYS.EMPLOYEE_PAYROLL_SETTINGS, cloud)
    set({ byId: cloud })
  },
}))
