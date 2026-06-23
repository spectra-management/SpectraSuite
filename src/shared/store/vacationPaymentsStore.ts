import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { saveAppState, fetchAppState } from '@/shared/lib/cloudSync'
import { mergeNestedByLeaf } from '@/shared/lib/cloudMerge'

/**
 * Tracks the once-per-year vacation payment per employee. DR pays ALL entitled
 * vacation days at the FIRST vacation request of the year — subsequent requests
 * that year generate no additional payment. Persisted to 'vacation_payments_made'
 * as { [bamboohrId]: { [year]: VacationPayment } }.
 */
export interface VacationPayment {
  date: string    // ISO timestamp the payment was generated/approved
  amount: number  // net amount paid
  gross: number   // gross vacation pay
  days: number    // entitled days paid (14 / 18 / 23)
  periodLabel?: string // first vacation period that triggered payment
}

type PaymentsStore = Record<string, Record<number, VacationPayment>>

interface VacationPaymentsState {
  payments: PaymentsStore
  getPayment: (employeeId: string, year: number) => VacationPayment | null
  markPaid: (employeeId: string, year: number, payment: VacationPayment) => void
  /** Read vacation payments back from Supabase (cloud-authoritative) and merge. */
  hydrateFromCloud: () => Promise<void>
}

export const useVacationPaymentsStore = create<VacationPaymentsState>((set, get) => ({
  payments: storage.get<PaymentsStore>(STORAGE_KEYS.VACATION_PAYMENTS) ?? {},

  getPayment: (employeeId, year) => get().payments[employeeId]?.[year] ?? null,

  markPaid: (employeeId, year, payment) => {
    const payments = {
      ...get().payments,
      [employeeId]: { ...(get().payments[employeeId] ?? {}), [year]: payment },
    }
    storage.set(STORAGE_KEYS.VACATION_PAYMENTS, payments)
    set({ payments })
    void saveAppState(STORAGE_KEYS.VACATION_PAYMENTS, payments)  // best-effort cloud mirror
  },

  // Cloud-authoritative read-back: pull the cloud blob, merge cloud-wins per
  // (employee, year) leaf, keep local-only leaves, and push the union back up if local
  // had anything the cloud lacked. Offline-safe (null cloud → local kept).
  hydrateFromCloud: async () => {
    const cloud = await fetchAppState<PaymentsStore>(STORAGE_KEYS.VACATION_PAYMENTS)
    if (!cloud) {
      if (Object.keys(get().payments).length > 0) void saveAppState(STORAGE_KEYS.VACATION_PAYMENTS, get().payments)
      return
    }
    const { merged, hasLocalOnly } = mergeNestedByLeaf(get().payments, cloud)
    storage.set(STORAGE_KEYS.VACATION_PAYMENTS, merged)
    set({ payments: merged })
    if (hasLocalOnly) void saveAppState(STORAGE_KEYS.VACATION_PAYMENTS, merged)
  },
}))
