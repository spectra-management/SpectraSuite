/**
 * Invoice line-item computation.
 *
 * Turns finalized Payroll hours/pay (from `@/shared/lib/payrollData`) into invoice
 * line items, applying the resolved rate per employee. Pure functions — no React,
 * no storage — so they're unit-testable.
 *
 * LINE TYPES (matching the company's real invoice):
 *   - 'hour'       → a "Base Pay" line (baseHours × baseRate) AND a separate
 *                    "Overtime Differential" line (overtimeHours × otRate).
 *   - 'fixed'      → one flat line (quantity 1 × fixedAmount).
 *   - 'percentage' → one line: percentageRate% × grossPay.
 * Bonus/incentive lines are added manually elsewhere (not computed here).
 */

import { roundHalfUp, safeNum } from '@/shared/lib/number'
import {
  aggregateByEmployee,
  getEmployeeBillingForRuns,
  getEmployeeBillingInRange,
  type EmployeeBillingAggregate,
} from '@/shared/lib/payrollData'
import type { BillingClient, ClientEmployee, InvoiceLineItem, TitleRate } from './types'
import { findTitleRate, resolveRate } from './rates'

let lineCounter = 0
function lineId(): string {
  lineCounter += 1
  return `ln_${Date.now().toString(36)}_${lineCounter.toString(36)}`
}

/** Minimal roster shape the compute layer needs (from the shared employees store). */
export interface RosterEmployee {
  id: string
  firstName: string
  lastName: string
  jobTitle: string
}

export interface ComputeInput {
  client: BillingClient
  assignments: ClientEmployee[]
  titleRates: TitleRate[]
  roster: RosterEmployee[]
  /** Either explicit run ids OR a date range — runIds takes precedence if non-empty. */
  payrollRunIds?: string[]
  periodStart?: string
  periodEnd?: string
}

export interface ComputeResult {
  lineItems: InvoiceLineItem[]
  /** Employees assigned but with NO finalized hours in the selection. */
  employeesWithoutHours: string[]
  /** Employees billed by 'hour'/'percentage' but missing a rate. */
  employeesWithoutRate: string[]
  /** Run ids that actually contributed hours. */
  usedRunIds: string[]
}

const fullName = (e: RosterEmployee) => `${e.firstName} ${e.lastName}`.trim()

/**
 * Build the (non-bonus) invoice lines for a client over a payroll selection.
 * Labels are i18n-resolved by the caller passing `labels`.
 */
export function computeInvoiceLines(
  input: ComputeInput,
  labels: { basePay: string; overtime: string; fixed: string; percentage: string },
): ComputeResult {
  const { client, assignments, titleRates, roster } = input

  const rows =
    input.payrollRunIds && input.payrollRunIds.length > 0
      ? getEmployeeBillingForRuns(input.payrollRunIds)
      : input.periodStart && input.periodEnd
        ? getEmployeeBillingInRange(input.periodStart, input.periodEnd)
        : []

  const byEmployee = aggregateByEmployee(rows)
  const rosterById = new Map(roster.map((e) => [e.id, e]))

  const lineItems: InvoiceLineItem[] = []
  const employeesWithoutHours: string[] = []
  const employeesWithoutRate: string[] = []
  const usedRunIds = new Set<string>()

  for (const assignment of assignments) {
    if (!assignment.active) continue
    const emp = rosterById.get(assignment.employeeId)
    const name = emp ? fullName(emp) : assignment.employeeId
    const title = emp?.jobTitle ?? ''
    const titleRate = findTitleRate(titleRates, client.id, title)
    const rate = resolveRate(client, assignment, titleRate)
    const agg: EmployeeBillingAggregate | undefined = byEmployee.get(assignment.employeeId)

    if (rate.method === 'fixed') {
      // Flat per-period — billed whether or not hours exist, but only if the
      // employee actually appears in a finalized run for the period.
      if (!agg) { employeesWithoutHours.push(name); continue }
      agg.runIds.forEach((r) => usedRunIds.add(r))
      const amount = roundHalfUp(safeNum(rate.fixedAmount), 2)
      lineItems.push(makeLine(assignment.employeeId, name, title, 'fixed', labels.fixed, 1, amount, amount))
      continue
    }

    if (rate.method === 'percentage') {
      if (!agg) { employeesWithoutHours.push(name); continue }
      agg.runIds.forEach((r) => usedRunIds.add(r))
      const pct = safeNum(rate.percentageRate)
      const amount = roundHalfUp((pct / 100) * agg.grossPay, 2)
      lineItems.push(
        makeLine(assignment.employeeId, name, title, 'percentage', `${labels.percentage} (${pct}%)`, 1, amount, amount),
      )
      continue
    }

    // 'hour' method → Base Pay + Overtime Differential as separate lines.
    if (!agg) { employeesWithoutHours.push(name); continue }
    if (!rate.hasBaseRate) employeesWithoutRate.push(name)
    agg.runIds.forEach((r) => usedRunIds.add(r))

    if (agg.baseHours > 0 || rate.baseRate > 0) {
      const amount = roundHalfUp(agg.baseHours * rate.baseRate, 2)
      lineItems.push(
        makeLine(assignment.employeeId, name, title, 'base', labels.basePay, agg.baseHours, rate.baseRate, amount),
      )
    }
    if (agg.overtimeHours > 0) {
      const amount = roundHalfUp(agg.overtimeHours * rate.otRate, 2)
      lineItems.push(
        makeLine(assignment.employeeId, name, title, 'overtime', labels.overtime, agg.overtimeHours, rate.otRate, amount),
      )
    }
  }

  return {
    lineItems,
    employeesWithoutHours,
    employeesWithoutRate,
    usedRunIds: [...usedRunIds],
  }
}

function makeLine(
  employeeId: string,
  employeeName: string,
  title: string,
  type: InvoiceLineItem['type'],
  label: string,
  quantity: number,
  rate: number,
  amount: number,
): InvoiceLineItem {
  return {
    id: lineId(),
    employeeId,
    employeeName,
    title,
    type,
    label,
    quantity: roundHalfUp(quantity, 2),
    rate: roundHalfUp(rate, 2),
    amount: roundHalfUp(amount, 2),
    manual: false,
  }
}

/** Sum line amounts → invoice subtotal/total (single currency, no tax line for now). */
export function sumLineItems(lines: InvoiceLineItem[]): number {
  return roundHalfUp(lines.reduce((acc, l) => acc + safeNum(l.amount), 0), 2)
}

/** Build a manual bonus/incentive line. */
export function makeBonusLine(args: {
  employeeId: string
  employeeName: string
  title: string
  label: string
  quantity: number
  amount: number
}): InvoiceLineItem {
  const qty = args.quantity > 0 ? args.quantity : 1
  const total = roundHalfUp(safeNum(args.amount), 2)
  return {
    id: lineId(),
    employeeId: args.employeeId,
    employeeName: args.employeeName,
    title: args.title,
    type: 'bonus',
    label: args.label,
    quantity: roundHalfUp(qty, 2),
    rate: roundHalfUp(total / qty, 2),
    amount: total,
    manual: true,
  }
}
