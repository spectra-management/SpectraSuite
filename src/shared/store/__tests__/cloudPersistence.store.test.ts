import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { PayrollPeriod } from '@/shared/types'

// Mock ONLY the cloud transport; the real stores + real merge helpers run.
const cloud = {
  payrollRuns: [] as PayrollPeriod[],
  appState: {} as Record<string, unknown>,
}

vi.mock('@/shared/lib/cloudSync', () => ({
  savePayrollRunCloud: vi.fn(async (r: PayrollPeriod) => {
    const i = cloud.payrollRuns.findIndex((x) => x.id === r.id)
    if (i >= 0) cloud.payrollRuns[i] = r
    else cloud.payrollRuns.push(r)
  }),
  fetchPayrollRunsCloud: vi.fn(async () => cloud.payrollRuns),
  saveAppState: vi.fn(async (key: string, value: unknown) => { cloud.appState[key] = value }),
  fetchAppState: vi.fn(async (key: string) => cloud.appState[key] ?? null),
}))

import { usePayrollStore } from '../payrollStore'
import { useVacationPaymentsStore } from '../vacationPaymentsStore'

const mkRun = (id: string, start: string, status: PayrollPeriod['status']): PayrollPeriod => ({
  id, startDate: start, endDate: start, frequency: 'biweekly', status, entries: [],
  totals: { totalGross: 0, totalAfp: 0, totalSfs: 0, totalTss: 0, totalIsr: 0, totalCustomDeductions: 0, totalDeductions: 0, totalNet: 0, employeeCount: 0 },
})

describe('payroll store cloud persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    cloud.payrollRuns = []
    cloud.appState = {}
    usePayrollStore.setState({ history: [], currentPayroll: null })
  })

  it('mirrors a FINALIZED run to the cloud on add, but not a draft', async () => {
    usePayrollStore.getState().addPayroll(mkRun('ignored-id', '2026-01-01', 'draft'))
    await Promise.resolve()
    expect(cloud.payrollRuns).toHaveLength(0) // drafts stay local

    const approved = usePayrollStore.getState().addPayroll(mkRun('x', '2026-02-01', 'approved'))
    await Promise.resolve()
    expect(cloud.payrollRuns.map((r) => r.id)).toContain(approved.id)
  })

  it('mirrors on update when a draft becomes approved', async () => {
    const draft = usePayrollStore.getState().addPayroll(mkRun('y', '2026-02-01', 'draft'))
    await Promise.resolve()
    expect(cloud.payrollRuns).toHaveLength(0)
    usePayrollStore.getState().updatePayroll(draft.id, { status: 'approved' })
    await Promise.resolve()
    expect(cloud.payrollRuns.map((r) => r.id)).toContain(draft.id)
  })

  it('hydrateFromCloud: cloud wins, local-only finalized runs uploaded', async () => {
    // Cloud already has run "b" (authoritative, net=500).
    const cloudB = mkRun('b', '2026-03-01', 'approved'); cloudB.totals.totalNet = 500
    cloud.payrollRuns = [cloudB]
    // Local has a stale "b" (net=0) and a local-only finalized "a".
    usePayrollStore.setState({ history: [mkRun('a', '2026-01-01', 'approved'), mkRun('b', '2026-03-01', 'approved')], currentPayroll: null })

    await usePayrollStore.getState().hydrateFromCloud()

    const hist = usePayrollStore.getState().history
    expect(hist.map((r) => r.id)).toEqual(['a', 'b']) // sorted, both present
    expect(hist.find((r) => r.id === 'b')!.totals.totalNet).toBe(500) // cloud won
    expect(cloud.payrollRuns.map((r) => r.id).sort()).toEqual(['a', 'b']) // local-only "a" uploaded
  })
})

describe('vacation payments store cloud persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    cloud.payrollRuns = []
    cloud.appState = {}
    useVacationPaymentsStore.setState({ payments: {} })
  })

  it('mirrors markPaid to app_state and reads back cloud-wins on hydrate', async () => {
    useVacationPaymentsStore.getState().markPaid('e1', 2026, { date: 'd', amount: 10, gross: 12, days: 14 })
    await Promise.resolve()
    expect(cloud.appState['vacation_payments_made']).toBeTruthy()

    // Cloud has a newer value for (e1,2026); local also has a local-only (e2,2026).
    cloud.appState['vacation_payments_made'] = { e1: { 2026: { date: 'd', amount: 999, gross: 12, days: 14 } } }
    useVacationPaymentsStore.setState({ payments: { e1: { 2026: { date: 'd', amount: 10, gross: 12, days: 14 } }, e2: { 2026: { date: 'd', amount: 5, gross: 6, days: 14 } } } })

    await useVacationPaymentsStore.getState().hydrateFromCloud()
    const p = useVacationPaymentsStore.getState().payments
    expect(p.e1[2026].amount).toBe(999) // cloud won
    expect(p.e2[2026].amount).toBe(5)   // local-only preserved
  })
})
