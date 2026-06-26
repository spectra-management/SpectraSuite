/**
 * BambooHR photo sync — download each employee's photo once and store it durably in the
 * private Supabase bucket, so avatars load from the DATABASE (no per-visit BambooHR fetch).
 *
 * Idempotent and cheap to re-run: a stored photo is only re-downloaded when its BambooHR
 * VERSION changes, and a manually-uploaded photo (source='manual') is never touched. The
 * version is the stable path segment of BambooHR's `photoUrl` (e.g. ".../photos/116-0-4.jpg"
 * → "116-0-4.jpg"); the middle number bumps whenever the photo is replaced in BambooHR.
 *
 * Runs client-side as an admin (same auth/RLS as manual uploads), in the background after a
 * directory sync. Best-effort: a single photo failing never aborts the batch.
 */

import type { RrhhEmployee } from '@/modules/rrhh/types'
import {
  fetchPhotoMeta,
  uploadBambooPhoto,
  type PhotoMeta,
} from '@/modules/rrhh/lib/photoStorage'

/** Concurrent downloads/uploads. Small enough to be gentle on the proxy and the browser. */
const CONCURRENCY = 5

/**
 * The stable version key for a BambooHR photo: the URL's path segment, stripped of the
 * (always-changing) signed-query string. Returns '' when there is no usable photoUrl.
 */
export function bambooPhotoVersion(photoUrl: string | undefined): string {
  if (!photoUrl) return ''
  const noQuery = photoUrl.split('?')[0]
  const file = noQuery.split('/').pop() ?? ''
  return file.trim()
}

export interface PhotoSyncItem {
  id: string
  version: string
}

/**
 * Decide which employees need their photo (re)downloaded:
 *   - skip employees with no BambooHR photo,
 *   - skip rows uploaded manually (they always win),
 *   - skip rows whose stored version already matches (unchanged),
 *   - otherwise include them.
 * Pure (no I/O) so it can be unit-tested.
 */
export function planPhotoSync(
  employees: Pick<RrhhEmployee, 'id' | 'photoUrl'>[],
  existing: Record<string, PhotoMeta>,
): PhotoSyncItem[] {
  const out: PhotoSyncItem[] = []
  for (const e of employees) {
    const version = bambooPhotoVersion(e.photoUrl)
    if (!version) continue
    const row = existing[e.id]
    if (row?.source === 'manual') continue
    if (row && row.bamboohrVersion === version && row.storagePath) continue
    out.push({ id: e.id, version })
  }
  return out
}

/** Build the proxy URL that streams an employee's current BambooHR photo (server-side key). */
function photoProxyUrl(subdomain: string, employeeId: string): string {
  const qs = new URLSearchParams({
    path: `/v1/employees/${employeeId}/photo/large`,
    subdomain,
  })
  return `/api/bamboohr?${qs.toString()}`
}

/** Download one photo through the proxy and store it. Resolves true on success. */
async function syncOne(subdomain: string, item: PhotoSyncItem): Promise<boolean> {
  try {
    const res = await fetch(photoProxyUrl(subdomain, item.id))
    if (!res.ok) return false
    const blob = await res.blob()
    if (blob.size === 0) return false
    await uploadBambooPhoto(item.id, blob, item.version)
    return true
  } catch {
    return false
  }
}

export interface PhotoSyncResult {
  /** Photos newly stored/updated this run. */
  synced: number
  /** Photos that needed syncing but failed (best-effort). */
  failed: number
  /** Total candidates that needed syncing. */
  planned: number
}

/**
 * Sync all changed BambooHR photos into the DB. Returns counts. Never throws; if the photo
 * metadata can't be read (not signed in / unconfigured) it no-ops with planned=0.
 */
export async function syncBambooPhotos(
  employees: Pick<RrhhEmployee, 'id' | 'photoUrl'>[],
  subdomain: string,
): Promise<PhotoSyncResult> {
  if (!subdomain) return { synced: 0, failed: 0, planned: 0 }
  const existing = await fetchPhotoMeta()
  if (existing === null) return { synced: 0, failed: 0, planned: 0 }

  const todo = planPhotoSync(employees, existing)
  let synced = 0
  let failed = 0

  // Simple fixed-size worker pool over the todo list.
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < todo.length) {
      const item = todo[cursor++]
      const ok = await syncOne(subdomain, item)
      if (ok) synced++
      else failed++
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker))

  return { synced, failed, planned: todo.length }
}
