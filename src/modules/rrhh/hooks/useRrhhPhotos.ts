/**
 * Offline-first hook for custom employee-photo overrides.
 *
 * - Exposes `customUrlFor(id)` so any avatar can pick up an admin-set photo.
 * - Hydrates once from Supabase (best-effort) and caches in the module store/localStorage.
 * - `upload`/`remove` are admin actions (the UI gates them behind the RBAC admin check);
 *   they update Supabase and the local cache so the change is visible immediately.
 */

import { useCallback, useEffect, useState } from 'react'
import { useRrhhPhotoStore } from '@/modules/rrhh/store/rrhhPhotoStore'
import {
  fetchPhotoOverrides,
  uploadEmployeePhoto,
  removeEmployeePhoto,
} from '@/modules/rrhh/lib/photoStorage'

export interface UseRrhhPhotos {
  overrides: Record<string, string>
  /** Custom photo URL for an employee, or undefined if none is set. */
  customUrlFor: (employeeId: string) => string | undefined
  /** Upload a custom photo (admin). Resolves to the new URL. Rejects on failure. */
  upload: (employeeId: string, file: File) => Promise<string>
  /** Remove a custom photo (admin), reverting to BambooHR/initials. */
  remove: (employeeId: string) => Promise<void>
  /** True while an upload/remove is in flight. */
  busy: boolean
}

export function useRrhhPhotos(): UseRrhhPhotos {
  const overrides = useRrhhPhotoStore((s) => s.overrides)
  const hydrated = useRrhhPhotoStore((s) => s.hydrated)
  const mergeFromCloud = useRrhhPhotoStore((s) => s.mergeFromCloud)
  const markHydrated = useRrhhPhotoStore((s) => s.markHydrated)
  const setOverride = useRrhhPhotoStore((s) => s.setOverride)
  const removeOverride = useRrhhPhotoStore((s) => s.removeOverride)

  const [busy, setBusy] = useState(false)

  // One-time cloud hydrate. If the fetch can't run (offline / not signed in) we keep the
  // localStorage cache untouched and just mark hydration attempted.
  useEffect(() => {
    if (hydrated) return
    let active = true
    void fetchPhotoOverrides().then((map) => {
      if (!active) return
      if (map) mergeFromCloud(map)
      else markHydrated()
    })
    return () => {
      active = false
    }
  }, [hydrated, mergeFromCloud, markHydrated])

  const customUrlFor = useCallback((employeeId: string) => overrides[employeeId], [overrides])

  const upload = useCallback(
    async (employeeId: string, file: File) => {
      setBusy(true)
      try {
        const url = await uploadEmployeePhoto(employeeId, file)
        setOverride(employeeId, url)
        return url
      } finally {
        setBusy(false)
      }
    },
    [setOverride],
  )

  const remove = useCallback(
    async (employeeId: string) => {
      setBusy(true)
      try {
        await removeEmployeePhoto(employeeId)
        removeOverride(employeeId)
      } finally {
        setBusy(false)
      }
    },
    [removeOverride],
  )

  return { overrides, customUrlFor, upload, remove, busy }
}
