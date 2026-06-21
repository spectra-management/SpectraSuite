/**
 * Custom employee-photo overrides store (offline-first, private-bucket).
 *
 * Two layers:
 *  - `overrides` (employeeId → storage PATH): the durable reference, persisted to
 *    localStorage as the offline cache. Supabase is the shared source of truth.
 *  - `signed` (employeeId → { url, exp }): short-lived signed URLs generated on demand
 *    from the private bucket. Kept IN MEMORY ONLY (never persisted) — they are capability
 *    URLs that expire, so there's no value (and some risk) in writing them to disk.
 */

import { create } from 'zustand'
import { storage } from '@/shared/lib/storage'
import type { SignedPhoto } from '@/modules/rrhh/lib/photoStorage'

const KEY = 'rrhh_photo_overrides'

interface RrhhPhotoState {
  /** employeeId → storage path (persisted offline cache). */
  overrides: Record<string, string>
  /** employeeId → cached signed URL (in-memory only). */
  signed: Record<string, SignedPhoto>
  /** True once we've attempted a cloud hydrate (success or graceful no-op). */
  hydrated: boolean

  setOverride: (employeeId: string, path: string) => void
  removeOverride: (employeeId: string) => void
  /** Replace the path cache with the cloud-authoritative map (cloud wins for shared data). */
  mergeFromCloud: (map: Record<string, string>) => void
  markHydrated: () => void
  /** Merge freshly generated signed URLs into the in-memory cache. */
  setSignedBatch: (entries: Record<string, SignedPhoto>) => void
}

export const useRrhhPhotoStore = create<RrhhPhotoState>((set) => ({
  overrides: storage.get<Record<string, string>>(KEY) ?? {},
  signed: {},
  hydrated: false,

  setOverride: (employeeId, path) =>
    set((s) => {
      const next = { ...s.overrides, [employeeId]: path }
      storage.set(KEY, next)
      return { overrides: next }
    }),

  removeOverride: (employeeId) =>
    set((s) => {
      const next = { ...s.overrides }
      delete next[employeeId]
      storage.set(KEY, next)
      const signed = { ...s.signed }
      delete signed[employeeId]
      return { overrides: next, signed }
    }),

  mergeFromCloud: (map) =>
    set(() => {
      storage.set(KEY, map)
      return { overrides: map, hydrated: true }
    }),

  markHydrated: () => set({ hydrated: true }),

  setSignedBatch: (entries) =>
    set((s) => ({ signed: { ...s.signed, ...entries } })),
}))
