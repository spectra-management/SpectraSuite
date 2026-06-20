import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import type { PaymentMethod } from '@/shared/types'

/**
 * Per-employee payment method, persisted separately from the BambooHR-synced
 * employee record (localStorage key 'employee_payment_methods') as
 * { [bamboohrId]: 'cash' | 'transfer' | 'check' }. Default is 'transfer'.
 */
export const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'transfer'

interface PaymentMethodsState {
  methods: Record<string, PaymentMethod>
  getMethod: (employeeId: string) => PaymentMethod
  setMethod: (employeeId: string, method: PaymentMethod) => void
}

export const usePaymentMethodsStore = create<PaymentMethodsState>((set, get) => ({
  methods: storage.get<Record<string, PaymentMethod>>(STORAGE_KEYS.PAYMENT_METHODS) ?? {},

  getMethod: (employeeId) => get().methods[employeeId] ?? DEFAULT_PAYMENT_METHOD,

  setMethod: (employeeId, method) => {
    const methods = { ...get().methods, [employeeId]: method }
    storage.set(STORAGE_KEYS.PAYMENT_METHODS, methods)
    set({ methods })
  },
}))
