/**
 * Pure helpers that turn an invoice's frozen line items into the two views the PDF renders:
 *   1. `rows` — the invoice table, with Base Pay and Overtime aggregated by role + rate, and
 *      bonuses/fixed/percentage kept per employee (matches the client invoice format).
 *   2. `hours` — a per-employee hours summary (Total Worked / Base / Overtime) for the
 *      hours-detail appendix. Everything derives from the same frozen line items.
 *
 * Pay-class text comes from each line's frozen `label` (set at creation), so the invoice
 * stays in the language it was made in.
 */
import { roundHalfUp } from '@/shared/lib/number'
import type { InvoiceLineItem, InvoiceLineType } from './types'

export interface InvoiceRow {
  /** Role/title (base/OT) or employee name (bonus/fixed/percentage). */
  description: string
  /** Frozen pay-class label: "Base Pay" | "Overtime Differential" | bonus/method label. */
  payClass: string
  /** Hours (base/OT) — null for non-hour lines (shows quantity instead). */
  hours: number | null
  /** Quantity for non-hour lines (bonus/fixed/percentage), else null. */
  quantity: number | null
  /** Per-unit rate; null when not applicable (percentage). */
  rate: number | null
  amount: number
}

export interface EmployeeHours {
  employeeName: string
  title: string
  baseHours: number
  overtimeHours: number
  totalWorked: number
}

const order: Record<InvoiceLineType, number> = { base: 0, overtime: 1, fixed: 2, percentage: 3, bonus: 4 }

/** Aggregate the invoice into display rows (Base/OT grouped by role+rate; others per line). */
export function toInvoiceRows(lineItems: InvoiceLineItem[]): InvoiceRow[] {
  const grouped = new Map<string, InvoiceRow & { _sort: number }>()
  const others: (InvoiceRow & { _sort: number })[] = []

  for (const l of lineItems) {
    if (l.type === 'base' || l.type === 'overtime') {
      const key = `${l.type}|${l.title}|${l.rate}`
      const prev = grouped.get(key)
      if (prev) {
        prev.hours = roundHalfUp((prev.hours ?? 0) + l.quantity, 2)
        prev.amount = roundHalfUp(prev.amount + l.amount, 2)
      } else {
        grouped.set(key, {
          description: l.type === 'base' ? (l.title || '') : '',
          payClass: l.label,
          hours: roundHalfUp(l.quantity, 2),
          quantity: null,
          rate: l.rate,
          amount: roundHalfUp(l.amount, 2),
          _sort: order[l.type],
        })
      }
    } else {
      others.push({
        description: l.employeeName,
        payClass: l.label,
        hours: null,
        quantity: l.quantity,
        rate: l.type === 'percentage' ? null : l.rate,
        amount: roundHalfUp(l.amount, 2),
        _sort: order[l.type],
      })
    }
  }

  const all = [...grouped.values(), ...others].sort((a, b) => a._sort - b._sort)
  return all.map(({ _sort: _omit, ...row }) => row)
}

/** Per-employee hours summary for the appendix, from the frozen base/OT line items. */
export function toEmployeeHours(lineItems: InvoiceLineItem[]): EmployeeHours[] {
  const byEmp = new Map<string, EmployeeHours>()
  for (const l of lineItems) {
    if (l.type !== 'base' && l.type !== 'overtime') continue
    const e = byEmp.get(l.employeeId) ?? {
      employeeName: l.employeeName, title: l.title, baseHours: 0, overtimeHours: 0, totalWorked: 0,
    }
    if (l.type === 'base') e.baseHours = roundHalfUp(e.baseHours + l.quantity, 2)
    else e.overtimeHours = roundHalfUp(e.overtimeHours + l.quantity, 2)
    e.totalWorked = roundHalfUp(e.baseHours + e.overtimeHours, 2)
    byEmp.set(l.employeeId, e)
  }
  return [...byEmp.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName))
}
