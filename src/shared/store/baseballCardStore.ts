import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { fetchBaseballCards, saveBaseballCard } from '@/shared/lib/cloudSync'
import type { BaseballCardOverrides } from '@/shared/lib/baseballCard'

/**
 * Per-employee baseball-card overrides, keyed by employee id. Auto-filled from HR at render
 * time; this store only holds the MANUAL overrides (and manual-only fields). Offline-first
 * cloud-authoritative: localStorage cache + Supabase (employee_baseball_cards, migration 015)
 * read back on login.
 */
interface BaseballCardState {
  byId: Record<string, BaseballCardOverrides>
  get: (employeeId: string) => BaseballCardOverrides
  /** Replace one employee's overrides (persists locally + to the cloud). */
  setCard: (employeeId: string, overrides: BaseballCardOverrides) => void
  hydrateFromCloud: () => Promise<void>
}

const EMPTY: BaseballCardOverrides = {}

export const useBaseballCardStore = create<BaseballCardState>((set, get) => ({
  byId: storage.get<Record<string, BaseballCardOverrides>>(STORAGE_KEYS.EMPLOYEE_BASEBALL_CARDS) ?? {},

  get: (employeeId) => get().byId[employeeId] ?? EMPTY,

  setCard: (employeeId, overrides) => {
    const byId = { ...get().byId, [employeeId]: overrides }
    storage.set(STORAGE_KEYS.EMPLOYEE_BASEBALL_CARDS, byId)
    set({ byId })
    void saveBaseballCard(employeeId, overrides)
  },

  hydrateFromCloud: async () => {
    const cloud = await fetchBaseballCards()
    if (Object.keys(cloud).length === 0) return // unreachable / not permitted / empty — keep cache
    storage.set(STORAGE_KEYS.EMPLOYEE_BASEBALL_CARDS, cloud)
    set({ byId: cloud })
  },
}))
