/**
 * Pure merge helpers for cloud-authoritative persistence (no Supabase / no React,
 * so they're fully unit-testable).
 *
 * CONFLICT RULE (matches the app's existing "cloud wins" pattern):
 *   - When the same record exists in BOTH localStorage and Supabase, the CLOUD copy
 *     wins (it is the durable source of truth).
 *   - Records that exist ONLY locally are preserved and surfaced for a one-time
 *     upload (migration), so nothing the user already had is lost in the transition.
 *   - Records that exist only in the cloud are restored locally (the read-back that
 *     fixes data-loss across deploys / new devices / localStorage clears).
 */

import type { PayrollPeriod, BambooHRConfig, HubstaffConfig } from '@/shared/types'

// ─── Generic flat string-keyed map (cloud wins per key) ──────────────────────────

export interface FlatMergeResult<T> {
  merged: Record<string, T>
  /** Keys present locally but absent in the cloud — candidates for upload. */
  localOnlyKeys: string[]
}

/** Cloud-wins union of two flat maps (cloud overrides local on key conflict). */
export function cloudWinsMerge<T>(
  local: Record<string, T>,
  cloud: Record<string, T>,
): FlatMergeResult<T> {
  const merged: Record<string, T> = { ...local, ...cloud }
  const localOnlyKeys = Object.keys(local).filter((k) => !(k in cloud))
  return { merged, localOnlyKeys }
}

// ─── Vacation payments: nested { employeeId: { year: payment } } ─────────────────

export interface NestedMergeResult<P> {
  merged: Record<string, Record<string, P>>
  /** True if any (employee, year) leaf exists locally but not in the cloud. */
  hasLocalOnly: boolean
}

/**
 * Two-level cloud-wins merge for the vacation-payments map. The cloud copy of a
 * given (employee, year) leaf wins; local-only leaves are kept and flagged.
 */
export function mergeNestedByLeaf<P>(
  local: Record<string, Record<string, P>>,
  cloud: Record<string, Record<string, P>>,
): NestedMergeResult<P> {
  const merged: Record<string, Record<string, P>> = {}
  let hasLocalOnly = false
  const employeeIds = new Set([...Object.keys(local ?? {}), ...Object.keys(cloud ?? {})])
  for (const emp of employeeIds) {
    const l = local?.[emp] ?? {}
    const c = cloud?.[emp] ?? {}
    merged[emp] = { ...l, ...c } // cloud leaf wins
    for (const yr of Object.keys(l)) if (!(yr in c)) hasLocalOnly = true
  }
  return { merged, hasLocalOnly }
}

// ─── Payroll runs (keyed by PayrollPeriod.id) ────────────────────────────────────

export interface PayrollMergeResult {
  merged: PayrollPeriod[]
  /** Local-only runs (by id) that the cloud doesn't have yet. */
  toUpload: PayrollPeriod[]
}

/**
 * Merge local and cloud payroll runs by id. Cloud is authoritative for shared ids;
 * local-only runs are appended and returned in `toUpload` for a best-effort upload.
 * Result is sorted by period start ascending (stable, deterministic for tests).
 */
export function mergePayrollRuns(
  local: PayrollPeriod[],
  cloud: PayrollPeriod[],
): PayrollMergeResult {
  const cloudById = new Map(cloud.map((r) => [r.id, r]))
  const toUpload = local.filter((r) => !cloudById.has(r.id))
  const merged = [...cloud, ...toUpload].sort((a, b) =>
    a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0,
  )
  return { merged, toUpload }
}

// ─── Connector configs (cloud creds applied over the local config) ───────────────

/**
 * Apply cloud-stored BambooHR credentials over the local config. Cloud wins for the
 * durable fields (subdomain, apiKey); `connected` becomes true if the cloud row is
 * active or a key is present. Returns the local config unchanged when cloud is null.
 */
export function applyBambooCloud(
  local: BambooHRConfig,
  cloud: Record<string, unknown> | null,
): BambooHRConfig {
  if (!cloud) return local
  const subdomain = typeof cloud.subdomain === 'string' && cloud.subdomain ? cloud.subdomain : local.subdomain
  const apiKey = typeof cloud.apiKey === 'string' && cloud.apiKey ? cloud.apiKey : local.apiKey
  const isActive = cloud.is_active === true
  return {
    ...local,
    subdomain,
    apiKey,
    connected: isActive || !!apiKey || local.connected,
  }
}

/**
 * Apply cloud-stored Hubstaff credentials over the local config. Cloud wins for the
 * durable fields (refreshToken, organizationId). Local-only runtime fields
 * (employeeMapping, cachedAccessToken/expiry) are preserved.
 */
export function applyHubstaffCloud(
  local: HubstaffConfig,
  cloud: Record<string, unknown> | null,
): HubstaffConfig {
  if (!cloud) return local
  const refreshToken =
    typeof cloud.refreshToken === 'string' && cloud.refreshToken ? cloud.refreshToken : local.refreshToken
  const organizationId =
    typeof cloud.orgId === 'string' && cloud.orgId
      ? cloud.orgId
      : typeof cloud.organizationId === 'string' && cloud.organizationId
        ? cloud.organizationId
        : local.organizationId
  const isActive = cloud.is_active === true
  return {
    ...local,
    refreshToken,
    organizationId,
    connected: isActive || !!refreshToken || local.connected,
  }
}
