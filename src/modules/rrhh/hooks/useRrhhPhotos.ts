/**
 * Offline-first hook for custom employee-photo overrides (private bucket + signed URLs).
 *
 * - Hydrates the path overrides once from Supabase (best-effort), cached in the module
 *   store / localStorage.
 * - Generates short-lived **signed URLs** on demand for the private bucket, in BATCH, and
 *   caches them in the store with their expiry. A background refresh regenerates URLs
 *   before they expire, so `signedUrlFor()` stays valid without per-render requests.
 * - `signedUrlFor(id)` returns the current custom photo URL (or undefined → the avatar
 *   falls back to BambooHR / initials; it never crashes on an expired/missing URL).
 * - `upload`/`remove` are admin actions (the UI gates them behind the RBAC admin check).
 *
 * Call this ONCE per page that renders avatars (the Directory page; the profile photo
 * editor). The store cache is shared, so signed URLs are not regenerated redundantly.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRrhhPhotoStore } from '@/modules/rrhh/store/rrhhPhotoStore'
import {
  fetchPhotoOverrides,
  uploadEmployeePhoto,
  removeEmployeePhoto,
  createSignedPhotoUrls,
} from '@/modules/rrhh/lib/photoStorage'

/** Regenerate a signed URL once it's within this window of expiry. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000
/** How often the background refresh checks for soon-to-expire URLs. */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000

export interface UseRrhhPhotos {
  /** Current signed custom photo URL for an employee, or undefined if none/unready. */
  signedUrlFor: (employeeId: string) => string | undefined
  /** Upload a custom photo (admin). Resolves to the storage path. Rejects on failure. */
  upload: (employeeId: string, file: File) => Promise<string>
  /** Remove a custom photo (admin), reverting to BambooHR/initials. */
  remove: (employeeId: string) => Promise<void>
  /** True while an upload/remove is in flight. */
  busy: boolean
}

export function useRrhhPhotos(): UseRrhhPhotos {
  const overrides = useRrhhPhotoStore((s) => s.overrides)
  const signed = useRrhhPhotoStore((s) => s.signed)
  const hydrated = useRrhhPhotoStore((s) => s.hydrated)
  const mergeFromCloud = useRrhhPhotoStore((s) => s.mergeFromCloud)
  const markHydrated = useRrhhPhotoStore((s) => s.markHydrated)
  const setOverride = useRrhhPhotoStore((s) => s.setOverride)
  const removeOverride = useRrhhPhotoStore((s) => s.removeOverride)
  const setSignedBatch = useRrhhPhotoStore((s) => s.setSignedBatch)

  const [busy, setBusy] = useState(false)

  // Latest values for the ensure-signed routine without making it a dependency churn.
  const overridesRef = useRef(overrides)
  overridesRef.current = overrides
  const signedRef = useRef(signed)
  signedRef.current = signed

  // One-time cloud hydrate of the path overrides. If the fetch can't run (offline / not
  // signed in) we keep the localStorage cache untouched and just mark hydration attempted.
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

  // Ensure every override path has a fresh signed URL. Batches all that are missing or
  // near expiry into a single request, then caches the results.
  const ensureSigned = useCallback(async () => {
    const now = Date.now()
    const need: Record<string, string> = {}
    for (const [id, path] of Object.entries(overridesRef.current)) {
      const entry = signedRef.current[id]
      if (!entry || entry.exp - now < REFRESH_MARGIN_MS) need[id] = path
    }
    if (Object.keys(need).length === 0) return
    const fresh = await createSignedPhotoUrls(need)
    if (Object.keys(fresh).length > 0) setSignedBatch(fresh)
  }, [setSignedBatch])

  // Sign on overrides change + periodically refresh before expiry.
  useEffect(() => {
    void ensureSigned()
    const timer = setInterval(() => void ensureSigned(), REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [overrides, ensureSigned])

  const signedUrlFor = useCallback(
    (employeeId: string): string | undefined => {
      const entry = signed[employeeId]
      if (entry && entry.exp > Date.now()) return entry.url
      return undefined
    },
    [signed],
  )

  const upload = useCallback(
    async (employeeId: string, file: File) => {
      setBusy(true)
      try {
        const path = await uploadEmployeePhoto(employeeId, file)
        setOverride(employeeId, path)
        // Sign immediately so the new photo shows without waiting for the next cycle.
        const fresh = await createSignedPhotoUrls({ [employeeId]: path })
        if (fresh[employeeId]) setSignedBatch(fresh)
        return path
      } finally {
        setBusy(false)
      }
    },
    [setOverride, setSignedBatch],
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

  return { signedUrlFor, upload, remove, busy }
}
