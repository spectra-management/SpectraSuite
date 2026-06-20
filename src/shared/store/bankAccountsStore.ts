import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import type { BankAccount } from '@/shared/types'

/**
 * Per-employee bank account (for Transfer payment method), persisted in
 * localStorage 'employee_bank_accounts' as { [bamboohrId]: { bank, accountNumber } }.
 * Manual today; will be auto-synced from BambooHR when that integration is available.
 */
export const RD_BANKS = [
  'Banco Popular',
  'BanReservas',
  'Scotiabank',
  'BHD León',
  'Asociación Popular',
  'Banco Santa Cruz',
  'Citibank',
  'Other',
] as const

const EMPTY: BankAccount = { bank: '', accountNumber: '' }

interface BankAccountsState {
  accounts: Record<string, BankAccount>
  getAccount: (employeeId: string) => BankAccount
  setAccount: (employeeId: string, patch: Partial<BankAccount>) => void
}

export const useBankAccountsStore = create<BankAccountsState>((set, get) => ({
  accounts: storage.get<Record<string, BankAccount>>(STORAGE_KEYS.BANK_ACCOUNTS) ?? {},

  getAccount: (employeeId) => get().accounts[employeeId] ?? EMPTY,

  setAccount: (employeeId, patch) => {
    const current = get().accounts[employeeId] ?? EMPTY
    const accounts = { ...get().accounts, [employeeId]: { ...current, ...patch } }
    storage.set(STORAGE_KEYS.BANK_ACCOUNTS, accounts)
    set({ accounts })
  },
}))
