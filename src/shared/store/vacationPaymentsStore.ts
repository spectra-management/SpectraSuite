import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'

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
  },
}))
