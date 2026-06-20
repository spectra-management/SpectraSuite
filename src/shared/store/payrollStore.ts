import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import type { PayrollPeriod } from '@/shared/types'
import { generateId } from '@/shared/lib/utils'

interface PayrollState {
  history: PayrollPeriod[]
  currentPayroll: PayrollPeriod | null
  addPayroll: (payroll: Omit<PayrollPeriod, 'id'>) => PayrollPeriod
  updatePayroll: (id: string, data: Partial<PayrollPeriod>) => void
  setCurrentPayroll: (payroll: PayrollPeriod | null) => void
  getPayroll: (id: string) => PayrollPeriod | undefined
}

export const usePayrollStore = create<PayrollState>((set, get) => ({
  history: storage.get<PayrollPeriod[]>(STORAGE_KEYS.PAYROLL_HISTORY) ?? [],
  currentPayroll: null,

  addPayroll: (payroll) => {
    const newPayroll: PayrollPeriod = { ...payroll, id: generateId() }
    const history = [...get().history, newPayroll]
    storage.set(STORAGE_KEYS.PAYROLL_HISTORY, history)
    set({ history, currentPayroll: newPayroll })
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
  },

  setCurrentPayroll: (payroll) => set({ currentPayroll: payroll }),

  getPayroll: (id) => get().history.find((p) => p.id === id),
}))
