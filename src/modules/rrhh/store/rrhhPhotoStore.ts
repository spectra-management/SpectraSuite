/**
 * Custom employee-photo overrides store (offline-first).
 *
 * Mirrors the module's existing pattern: Zustand + the shared `storage` abstraction as
 * the offline cache, with Supabase as the shared source of truth (so a photo an admin
 * uploads is seen by everyone). Maps `employeeId → public photo URL`.
 */

import { create } from 'zustand'
import { storage } from '@/shared/lib/storage'

const KEY = 'rrhh_photo_overrides'

interface RrhhPhotoState {
  /** employeeId → custom public photo URL. */
  overrides: Record<string, string>
  /** True once we've attempted a cloud hydrate (success or graceful no-op). */
  hydrated: boolean

  setOverride: (employeeId: string, url: string) => void
  removeOverride: (employeeId: string) => void
  /** Replace the cache with the cloud-authoritative map (cloud wins for shared data). */
  mergeFromCloud: (map: Record<string, string>) => void
  markHydrated: () => void
}

export const useRrhhPhotoStore = create<RrhhPhotoState>((set) => ({
  overrides: storage.get<Record<string, string>>(KEY) ?? {},
  hydrated: false,

  setOverride: (employeeId, url) =>
    set((s) => {
      const next = { ...s.overrides, [employeeId]: url }
      storage.set(KEY, next)
      return { overrides: next }
    }),

  removeOverride: (employeeId) =>
    set((s) => {
      const next = { ...s.overrides }
      delete next[employeeId]
      storage.set(KEY, next)
      return { overrides: next }
    }),

  mergeFromCloud: (map) =>
    set(() => {
      storage.set(KEY, map)
      return { overrides: map, hydrated: true }
    }),

  markHydrated: () => set({ hydrated: true }),
}))
