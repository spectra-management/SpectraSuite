import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import type { PayrollPeriod } from '@/shared/types'
import { generateId } from '@/shared/lib/utils'
import { savePayrollRunCloud, fetchPayrollRunsCloud } from '@/shared/lib/cloudSync'
import { mergePayrollRuns } from '@/shared/lib/cloudMerge'

interface PayrollState {
  history: PayrollPeriod[]
  currentPayroll: PayrollPeriod | null
  addPayroll: (payroll: Omit<PayrollPeriod, 'id'>) => PayrollPeriod
  updatePayroll: (id: string, data: Partial<PayrollPeriod>) => void
  setCurrentPayroll: (payroll: PayrollPeriod | null) => void
  getPayroll: (id: string) => PayrollPeriod | undefined
  /** Read payroll history back from Supabase (cloud-authoritative) and merge. */
  hydrateFromCloud: () => Promise<void>
}

// Finalized runs are the ones worth mirroring to the cloud (drafts stay local until
// they're approved/sent), matching `payroll_runs` being the durable record of paid work.
const isFinalized = (p: PayrollPeriod) => p.status === 'approved' || p.status === 'sent'

export const usePayrollStore = create<PayrollState>((set, get) => ({
  history: storage.get<PayrollPeriod[]>(STORAGE_KEYS.PAYROLL_HISTORY) ?? [],
  currentPayroll: null,

  addPayroll: (payroll) => {
    const newPayroll: PayrollPeriod = { ...payroll, id: generateId() }
    const history = [...get().history, newPayroll]
    storage.set(STORAGE_KEYS.PAYROLL_HISTORY, history)
    set({ history, currentPayroll: newPayroll })
    if (isFinalized(newPayroll)) void savePayrollRunCloud(newPayroll)  // best-effort cloud mirror
    return newPayroll
  },

  updatePayroll: (id, data) => {
    const history = get().history.map((p) => (p.id === id ? { ...p, ...data } : p))
    storage.set(STORAGE_KEYS.PAYROLL_HISTORY, history)
    const currentPayroll = get().currentPayroll
    set({
      history,
      currentPayroll: currentPayroll?.id === id ? { ...currentPayroll, ...data } : currentPayroll,
    })
    const updated = history.find((p) => p.id === id)
    if (updated && isFinalized(updated)) void savePayrollRunCloud(updated)  // best-effort cloud mirror
  },

  setCurrentPayroll: (payroll) => set({ currentPayroll: payroll }),

  getPayroll: (id) => get().history.find((p) => p.id === id),

  // Cloud is the durable source of truth: pull cloud runs, merge cloud-wins by id, and
  // upload any finalized local-only runs (one-time migration of pre-existing data).
  // Offline-safe: if the cloud is unreachable, fetch returns [] and local history is kept.
  hydrateFromCloud: async () => {
    const cloud = await fetchPayrollRunsCloud()
    if (cloud.length === 0) {
      // Nothing in the cloud yet — push existing finalized local runs up (migration).
      for (const run of get().history.filter(isFinalized)) void savePayrollRunCloud(run)
      return
    }
    const { merged, toUpload } = mergePayrollRuns(get().history, cloud)
    storage.set(STORAGE_KEYS.PAYROLL_HISTORY, merged)
    set({ history: merged })
    for (const run of toUpload.filter(isFinalized)) void savePayrollRunCloud(run)
  },
}))
