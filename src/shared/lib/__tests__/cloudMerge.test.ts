import { describe, it, expect, beforeEach } from 'vitest'
import {
  cloudWinsMerge,
  mergeNestedByLeaf,
  mergePayrollRuns,
  applyBambooCloud,
  applyHubstaffCloud,
} from '../cloudMerge'
import { clearAuthSessionKeys, AUTH_LOCAL_KEYS } from '../sessionReset'
import type { PayrollPeriod, BambooHRConfig, HubstaffConfig } from '@/shared/types'

const run = (id: string, startDate: string, status: PayrollPeriod['status'] = 'approved'): PayrollPeriod => ({
  id, startDate, endDate: startDate, frequency: 'biweekly', status,
  entries: [], totals: { totalGross: 0, totalAfp: 0, totalSfs: 0, totalTss: 0, totalIsr: 0, totalCustomDeductions: 0, totalDeductions: 0, totalNet: 0, employeeCount: 0 },
})

describe('cloudWinsMerge (flat, cloud wins per key)', () => {
  it('cloud overrides local on key conflict; local-only kept and flagged', () => {
    const local = { a: 1, b: 2 }
    const cloud = { b: 99, c: 3 }
    const { merged, localOnlyKeys } = cloudWinsMerge(local, cloud)
    expect(merged).toEqual({ a: 1, b: 99, c: 3 }) // cloud b wins
    expect(localOnlyKeys).toEqual(['a'])
  })

  it('empty cloud keeps all local and marks all as local-only', () => {
    const { merged, localOnlyKeys } = cloudWinsMerge({ a: 1, b: 2 }, {})
    expect(merged).toEqual({ a: 1, b: 2 })
    expect(localOnlyKeys.sort()).toEqual(['a', 'b'])
  })
})

describe('mergeNestedByLeaf (vacation payments, cloud wins per (employee, year))', () => {
  it('cloud leaf wins; local-only leaves preserved', () => {
    const local = { e1: { 2025: { amount: 10 }, 2026: { amount: 11 } } }
    const cloud = { e1: { 2026: { amount: 999 } }, e2: { 2026: { amount: 5 } } }
    const { merged, hasLocalOnly } = mergeNestedByLeaf(local as never, cloud as never)
    expect(merged).toEqual({
      e1: { 2025: { amount: 10 }, 2026: { amount: 999 } }, // cloud 2026 wins, local 2025 kept
      e2: { 2026: { amount: 5 } },
    })
    expect(hasLocalOnly).toBe(true) // e1/2025 only local
  })

  it('no local-only when cloud is a superset', () => {
    const local = { e1: { 2026: { amount: 11 } } }
    const cloud = { e1: { 2026: { amount: 11 } } }
    const { hasLocalOnly } = mergeNestedByLeaf(local as never, cloud as never)
    expect(hasLocalOnly).toBe(false)
  })
})

describe('mergePayrollRuns (cloud authoritative by id, local-only uploaded)', () => {
  it('cloud wins on shared id; local-only returned for upload; sorted by start', () => {
    const local = [run('a', '2026-01-01'), run('b', '2026-03-01')]
    const cloudB = run('b', '2026-03-01'); cloudB.totals.totalNet = 500
    const cloud = [cloudB, run('c', '2026-02-01')]
    const { merged, toUpload } = mergePayrollRuns(local, cloud)
    expect(merged.map((r) => r.id)).toEqual(['a', 'c', 'b']) // sorted by startDate
    // 'b' came from cloud (authoritative), not local
    expect(merged.find((r) => r.id === 'b')!.totals.totalNet).toBe(500)
    expect(toUpload.map((r) => r.id)).toEqual(['a']) // only local-only
  })

  it('empty cloud → everything is local-only (migration upload)', () => {
    const local = [run('a', '2026-01-01'), run('b', '2026-02-01')]
    const { merged, toUpload } = mergePayrollRuns(local, [])
    expect(merged).toHaveLength(2)
    expect(toUpload).toHaveLength(2)
  })
})

describe('applyBambooCloud / applyHubstaffCloud (connector read-back)', () => {
  const baseBamboo: BambooHRConfig = { subdomain: '', apiKey: '', connected: false }
  const baseHubstaff: HubstaffConfig = { refreshToken: '', organizationId: '', connected: false, employeeMapping: [] }

  it('restores BambooHR creds from cloud and marks connected', () => {
    const merged = applyBambooCloud(baseBamboo, { subdomain: 'acme', apiKey: 'KEY', is_active: true })
    expect(merged.subdomain).toBe('acme')
    expect(merged.apiKey).toBe('KEY')
    expect(merged.connected).toBe(true)
  })

  it('null cloud leaves local config untouched', () => {
    expect(applyBambooCloud(baseBamboo, null)).toEqual(baseBamboo)
    expect(applyHubstaffCloud(baseHubstaff, null)).toEqual(baseHubstaff)
  })

  it('restores Hubstaff token + orgId and preserves local employeeMapping', () => {
    const local: HubstaffConfig = { ...baseHubstaff, employeeMapping: [{ hubstaffUserId: 'h1', bambooEmployeeId: 'b1', autoMatched: true }] }
    const merged = applyHubstaffCloud(local, { refreshToken: 'RT', orgId: '42', is_active: true })
    expect(merged.refreshToken).toBe('RT')
    expect(merged.organizationId).toBe('42')
    expect(merged.connected).toBe(true)
    expect(merged.employeeMapping).toHaveLength(1) // local-only runtime field preserved
  })

  it('cloud wins over a stale local token', () => {
    const local: HubstaffConfig = { ...baseHubstaff, refreshToken: 'OLD', connected: true }
    const merged = applyHubstaffCloud(local, { refreshToken: 'NEW', orgId: '1', is_active: true })
    expect(merged.refreshToken).toBe('NEW')
  })
})

describe('clearAuthSessionKeys (timeout clears ONLY session/auth keys)', () => {
  beforeEach(() => localStorage.clear())

  it('removes auth/session keys but preserves all business data', () => {
    // business data
    localStorage.setItem('spectra_payroll_history', '[{"id":"x"}]')
    localStorage.setItem('spectra_employees', '[]')
    localStorage.setItem('spectra_bamboohr_config', '{"connected":true}')
    localStorage.setItem('theme', 'dark')
    // auth/session data
    localStorage.setItem('google_provider_token', 'tok')
    localStorage.setItem('google_provider_refresh_token', 'rtok')
    localStorage.setItem('sb-abcde-auth-token', 'session')

    clearAuthSessionKeys()

    // business preserved
    expect(localStorage.getItem('spectra_payroll_history')).toBe('[{"id":"x"}]')
    expect(localStorage.getItem('spectra_employees')).toBe('[]')
    expect(localStorage.getItem('spectra_bamboohr_config')).toBe('{"connected":true}')
    expect(localStorage.getItem('theme')).toBe('dark')
    // auth/session removed
    for (const k of AUTH_LOCAL_KEYS) expect(localStorage.getItem(k)).toBeNull()
    expect(localStorage.getItem('sb-abcde-auth-token')).toBeNull()
  })
})
