/**
 * Shared read-only accessor for FINALIZED payroll data.
 *
 * WHY THIS EXISTS
 * ---------------
 * Feature modules may not import each other (see src/IMPORT_RULES.md). The Billing
 * (facturación) module needs the hours and pay that the Payroll (nómina) module
 * actually FINALIZED, so billing matches what was really paid — not raw Hubstaff
 * hours. This module is that bridge: it lives in `shared/lib` and reads the same
 * `spectra_payroll_history` localStorage key the payroll store persists to, exposing
 * a small, billing-oriented surface. Billing imports THIS, never `@/modules/nomina`.
 *
 * LAYERING: `shared/lib` must stay store-agnostic (no `shared/store` imports), so we
 * read persisted runs straight from the storage abstraction rather than the Zustand
 * payroll store. The shape returned here is intentionally decoupled from the internal
 * `PayrollPeriod` so callers don't depend on payroll internals.
 *
 * "FINALIZED / PAID" maps to payroll run status `approved` (verified) or `sent`
 * (paystubs distributed / paid). `draft` runs are never billable.
 */

import { storage, STORAGE_KEYS } from './storage'
import { roundHalfUp, safeNum } from './number'
import type { PayrollPeriod } from '@/shared/types'

/** Payroll statuses that represent finalized/paid work eligible for billing. */
export type BillableRunStatus = 'approved' | 'sent'

const BILLABLE_STATUSES: ReadonlySet<string> = new Set(['approved', 'sent'])

export function isBillableStatus(status: string): status is BillableRunStatus {
  return BILLABLE_STATUSES.has(status)
}

/** A finalized payroll run, summarized for billing selection. */
export interface BillableRunSummary {
  id: string
  startDate: string
  endDate: string
  frequency: PayrollPeriod['frequency']
  status: BillableRunStatus
  processedDate?: string
  /** Country the run was processed for (drives currency display). */
  country?: string
  employeeCount: number
}

/**
 * One employee's finalized hours/pay within a single payroll run.
 *
 * HOURS SPLIT: Payroll tracks `regularHours`, `otHours` and `holidayHours`. Billing
 * bills two line types — Base Pay and Overtime — so we map:
 *   - baseHours      = regularHours
 *   - overtimeHours  = otHours + holidayHours   (both billed at the overtime rate)
 * If a client ever needs holiday billed separately, split it here.
 *
 * PAY (for the percentage billing method):
 *   - grossPay = total employee earnings for the period (the labor-cost basis)
 *   - netPay   = take-home after deductions (exposed for completeness)
 * The percentage method bills `rate% × grossPay` by default.
 */
export interface EmployeeRunBilling {
  runId: string
  employeeId: string
  periodStart: string
  periodEnd: string
  status: BillableRunStatus
  country?: string
  baseHours: number
  overtimeHours: number
  grossPay: number
  netPay: number
}

function loadRuns(): PayrollPeriod[] {
  return storage.get<PayrollPeriod[]>(STORAGE_KEYS.PAYROLL_HISTORY) ?? []
}

/** All finalized (approved/sent) runs, newest period first. */
export function getBillablePayrollRuns(): BillableRunSummary[] {
  return loadRuns()
    .filter((r) => isBillableStatus(r.status))
    .map((r) => ({
      id: r.id,
      startDate: r.startDate,
      endDate: r.endDate,
      frequency: r.frequency,
      status: r.status as BillableRunStatus,
      processedDate: r.processedDate,
      country: r.country,
      employeeCount: r.entries.length,
    }))
    .sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0))
}

function runToBillingRows(run: PayrollPeriod): EmployeeRunBilling[] {
  return run.entries.map((entry) => {
    const h = entry.hours
    const c = entry.calculation
    return {
      runId: run.id,
      employeeId: entry.employee.id,
      periodStart: run.startDate,
      periodEnd: run.endDate,
      status: run.status as BillableRunStatus,
      country: run.country,
      baseHours: roundHalfUp(safeNum(h.regularHours), 2),
      overtimeHours: roundHalfUp(safeNum(h.otHours) + safeNum(h.holidayHours), 2),
      grossPay: roundHalfUp(safeNum(c.grossPay), 2),
      netPay: roundHalfUp(safeNum(c.netPay), 2),
    }
  })
}

/** Per-employee billing rows across a set of finalized run ids. */
export function getEmployeeBillingForRuns(runIds: string[]): EmployeeRunBilling[] {
  const wanted = new Set(runIds)
  return loadRuns()
    .filter((r) => wanted.has(r.id) && isBillableStatus(r.status))
    .flatMap(runToBillingRows)
}

/**
 * Per-employee billing rows for every finalized run whose period overlaps
 * [start, end] (inclusive, YYYY-MM-DD). Used to bill "all hours in this month".
 */
export function getEmployeeBillingInRange(start: string, end: string): EmployeeRunBilling[] {
  return loadRuns()
    .filter((r) => isBillableStatus(r.status) && r.startDate <= end && r.endDate >= start)
    .flatMap(runToBillingRows)
}

/** Aggregated totals for one employee across the supplied billing rows. */
export interface EmployeeBillingAggregate {
  employeeId: string
  baseHours: number
  overtimeHours: number
  grossPay: number
  netPay: number
  runIds: string[]
}

/** Sum billing rows per employee (e.g. across several runs in a month). */
export function aggregateByEmployee(rows: EmployeeRunBilling[]): Map<string, EmployeeBillingAggregate> {
  const map = new Map<string, EmployeeBillingAggregate>()
  for (const r of rows) {
    const cur = map.get(r.employeeId) ?? {
      employeeId: r.employeeId,
      baseHours: 0,
      overtimeHours: 0,
      grossPay: 0,
      netPay: 0,
      runIds: [] as string[],
    }
    cur.baseHours = roundHalfUp(cur.baseHours + r.baseHours, 2)
    cur.overtimeHours = roundHalfUp(cur.overtimeHours + r.overtimeHours, 2)
    cur.grossPay = roundHalfUp(cur.grossPay + r.grossPay, 2)
    cur.netPay = roundHalfUp(cur.netPay + r.netPay, 2)
    if (!cur.runIds.includes(r.runId)) cur.runIds.push(r.runId)
    map.set(r.employeeId, cur)
  }
  return map
}
