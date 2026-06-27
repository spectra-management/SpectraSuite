/**
 * Custom employee-photo storage (APP-LOCAL — never touches BambooHR).
 *
 * An admin can upload a custom photo that overrides the BambooHR photo for everyone.
 * Photos live in a **PRIVATE** Supabase Storage bucket; a small table records the storage
 * PATH per employee. Because the bucket is private, no image is publicly reachable by URL —
 * the app generates a short-lived **signed URL** on demand (for authenticated users only)
 * whenever an avatar needs to be displayed.
 *
 * ── Manual Supabase setup the user must do (see RRHH_PROGRESS.md §6d for full detail) ──
 *   Bucket:  `employee-photos`  (PRIVATE — no public access)
 *   Table:   `rrhh_employee_photos (employee_id text pk, storage_path text,
 *            updated_at timestamptz, updated_by uuid)`
 *   Policies: storage read (SELECT) = authenticated · storage write = admins only;
 *            table read = authenticated · table write = admins only.
 *
 * This module only READS from / WRITES to those resources — it does not create the
 * bucket or policies (that is done in the Supabase dashboard by the user).
 */

import { supabase, isSupabaseConfigured } from '@/shared/lib/supabase'

export const EMPLOYEE_PHOTOS_BUCKET = 'employee-photos'
const TABLE = 'rrhh_employee_photos'

/** Max accepted upload size (5 MB). */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

/** How long a generated signed URL stays valid (1 hour). */
export const SIGNED_URL_TTL_SECONDS = 3600

/** A cached signed URL with its absolute expiry (epoch ms). */
export interface SignedPhoto {
  url: string
  exp: number
}

/** Where a stored photo came from. 'manual' uploads always win over a 'bamboohr' sync. */
export type PhotoSource = 'manual' | 'bamboohr'

interface PhotoRow {
  employee_id: string
  storage_path: string
}

/** Full photo record used by the sync to decide what to (re)download. */
export interface PhotoMeta {
  storagePath: string
  source: PhotoSource
  /** BambooHR photo version (photoUrl path segment); null for manual uploads. */
  bamboohrVersion: string | null
}

async function isAuthenticated(): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

/** Normalised file extension for the upload, derived from the MIME type or filename. */
function extFor(file: File): string {
  const fromType = file.type.split('/')[1]?.toLowerCase()
  const raw = fromType || file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const clean = raw.replace(/[^a-z0-9]/g, '')
  return clean === 'jpeg' ? 'jpg' : clean || 'jpg'
}

/**
 * Fetch every custom photo override (employeeId → storage PATH).
 * Returns `null` when overrides can't be read (Supabase unconfigured or not signed in),
 * so callers can distinguish "couldn't fetch" from "none exist" and avoid wiping the
 * offline cache. Best-effort: never throws.
 */
export async function fetchPhotoOverrides(): Promise<Record<string, string> | null> {
  if (!(await isAuthenticated())) return null
  try {
    const { data, error } = await supabase.from(TABLE).select('employee_id, storage_path')
    if (error || !data) return null
    const out: Record<string, string> = {}
    for (const row of data as PhotoRow[]) {
      if (row.employee_id && row.storage_path) out[row.employee_id] = row.storage_path
    }
    return out
  } catch (e) {
    console.warn('[rrhh-photo] fetchPhotoOverrides failed:', e)
    return null
  }
}

/**
 * Fetch the full photo record for every employee (id → { storagePath, source, version }).
 * Used by the BambooHR photo sync to decide which photos changed and must be re-downloaded,
 * and to skip rows that were uploaded manually. Returns `null` when unreadable. Never throws.
 */
export async function fetchPhotoMeta(): Promise<Record<string, PhotoMeta> | null> {
  if (!(await isAuthenticated())) return null
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('employee_id, storage_path, source, bamboohr_version')
    if (error || !data) return null
    const out: Record<string, PhotoMeta> = {}
    for (const row of data as Array<PhotoRow & { source?: string; bamboohr_version?: string | null }>) {
      if (!row.employee_id || !row.storage_path) continue
      out[row.employee_id] = {
        storagePath: row.storage_path,
        source: row.source === 'bamboohr' ? 'bamboohr' : 'manual',
        bamboohrVersion: row.bamboohr_version ?? null,
      }
    }
    return out
  } catch (e) {
    console.warn('[rrhh-photo] fetchPhotoMeta failed:', e)
    return null
  }
}

/**
 * Fetch the storage PATH of EVERY stored photo (manual uploads AND synced BambooHR photos),
 * as `employeeId → storagePath`. This is what the avatar layer should hydrate so a photo that
 * was already persisted in the DB (by a prior BambooHR sync) is shown from Supabase via a
 * signed URL — instead of re-fetching it from BambooHR on every profile open.
 * Returns `null` when unreadable (offline / not signed in) so the offline cache is preserved.
 * Best-effort: never throws.
 */
export async function fetchAllPhotoPaths(): Promise<Record<string, string> | null> {
  const meta = await fetchPhotoMeta()
  if (!meta) return null
  const out: Record<string, string> = {}
  for (const [id, m] of Object.entries(meta)) out[id] = m.storagePath
  return out
}

/**
 * Store a photo downloaded from BambooHR for `employeeId` in the private bucket and record
 * it (source='bamboohr' + the version that produced it). Used by the sync. Throws on failure
 * so the caller can count/skip. NEVER call this for an employee whose row is source='manual'
 * — the caller must guard that (a manual upload always wins).
 */
export async function uploadBambooPhoto(
  employeeId: string,
  blob: Blob,
  version: string,
): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('supabase-not-configured')

  // Synced photos live under a `bamboohr/` prefix so they never collide with the
  // `{id}.{ext}` path a manual upload uses at the bucket root.
  const path = `bamboohr/${employeeId}.jpg`

  const { error: upErr } = await supabase.storage
    .from(EMPLOYEE_PHOTOS_BUCKET)
    .upload(path, blob, { upsert: true, contentType: 'image/jpeg', cacheControl: '3600' })
  if (upErr) throw new Error(upErr.message)

  const { error: tErr } = await supabase.from(TABLE).upsert(
    {
      employee_id: employeeId,
      storage_path: path,
      source: 'bamboohr',
      bamboohr_version: version,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'employee_id' },
  )
  if (tErr) throw new Error(tErr.message)

  return path
}

/**
 * Generate signed URLs for a batch of storage paths (private-bucket read).
 * Input is `employeeId → storagePath`; output is `employeeId → { url, exp }`, including
 * only the paths that signed successfully. Best-effort: never throws (returns `{}` on
 * failure) so the avatar simply falls back to the BambooHR photo / initials.
 */
export async function createSignedPhotoUrls(
  pathsById: Record<string, string>,
  ttlSeconds: number = SIGNED_URL_TTL_SECONDS,
): Promise<Record<string, SignedPhoto>> {
  const entries = Object.entries(pathsById)
  if (entries.length === 0 || !isSupabaseConfigured) return {}
  try {
    const paths = entries.map(([, p]) => p)
    const { data, error } = await supabase.storage
      .from(EMPLOYEE_PHOTOS_BUCKET)
      .createSignedUrls(paths, ttlSeconds)
    if (error || !data) return {}
    const exp = Date.now() + ttlSeconds * 1000
    const out: Record<string, SignedPhoto> = {}
    data.forEach((row, i) => {
      const id = entries[i][0]
      if (row.signedUrl && !row.error) out[id] = { url: row.signedUrl, exp }
    })
    return out
  } catch (e) {
    console.warn('[rrhh-photo] createSignedPhotoUrls failed:', e)
    return {}
  }
}

/**
 * Upload a custom photo for `employeeId`, overwriting any previous one, and record its
 * storage PATH in the overrides table. Returns the storage path (the displayable URL is a
 * signed URL generated separately, on demand). Throws (with a message) on failure.
 *
 * NOTE: this is APP-LOCAL Supabase storage only. It NEVER calls BambooHR.
 */
export async function uploadEmployeePhoto(employeeId: string, file: File): Promise<string> {
  if (!isSupabaseConfigured) throw new Error('supabase-not-configured')

  const path = `${employeeId}.${extFor(file)}`

  // If a prior override used a different extension, remove the stale object so we don't
  // orphan files in the bucket. Best-effort — ignore failures.
  try {
    const { data: prev } = await supabase
      .from(TABLE)
      .select('storage_path')
      .eq('employee_id', employeeId)
      .maybeSingle()
    const prevPath = (prev as Pick<PhotoRow, 'storage_path'> | null)?.storage_path
    if (prevPath && prevPath !== path) {
      await supabase.storage.from(EMPLOYEE_PHOTOS_BUCKET).remove([prevPath])
    }
  } catch {
    /* ignore cleanup errors */
  }

  const { error: upErr } = await supabase.storage
    .from(EMPLOYEE_PHOTOS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
  if (upErr) throw new Error(upErr.message)

  const { error: tErr } = await supabase.from(TABLE).upsert(
    {
      employee_id: employeeId,
      storage_path: path,
      // A manual upload always wins: mark the row so the BambooHR sync never overwrites it.
      source: 'manual',
      bamboohr_version: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'employee_id' },
  )
  if (tErr) throw new Error(tErr.message)

  return path
}

/**
 * Remove an employee's custom photo (storage object + table row), reverting to the
 * BambooHR photo / initials. Throws on a hard failure so the caller can surface it.
 */
export async function removeEmployeePhoto(employeeId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('supabase-not-configured')

  const { data } = await supabase
    .from(TABLE)
    .select('storage_path')
    .eq('employee_id', employeeId)
    .maybeSingle()
  const path = (data as Pick<PhotoRow, 'storage_path'> | null)?.storage_path
  if (path) {
    await supabase.storage.from(EMPLOYEE_PHOTOS_BUCKET).remove([path])
  }

  const { error } = await supabase.from(TABLE).delete().eq('employee_id', employeeId)
  if (error) throw new Error(error.message)
}
