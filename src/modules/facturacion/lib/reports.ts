/**
 * Pure aggregation helpers for the billing reports. No React/store — testable.
 * All figures derive from finalized + draft invoices already in the store.
 */

import { roundHalfUp, safeNum } from '@/shared/lib/number'
import type { Invoice, InvoiceLineType } from './types'

export interface ClientRevenueRow {
  clientId: string
  clientName: string
  invoiceCount: number
  finalizedTotal: number
  draftTotal: number
}

export interface MonthRevenueRow {
  month: string // YYYY-MM
  total: number
  invoiceCount: number
}

export interface LineTypeRow {
  type: InvoiceLineType
  total: number
}

const monthOf = (dateStr: string) => (dateStr || '').slice(0, 7)

/** Revenue grouped by client (finalized vs still-draft). */
export function revenueByClient(invoices: Invoice[], nameFor: (id: string) => string): ClientRevenueRow[] {
  const map = new Map<string, ClientRevenueRow>()
  for (const inv of invoices) {
    const row = map.get(inv.clientId) ?? {
      clientId: inv.clientId, clientName: nameFor(inv.clientId), invoiceCount: 0, finalizedTotal: 0, draftTotal: 0,
    }
    row.invoiceCount += 1
    if (inv.status === 'finalized') row.finalizedTotal = roundHalfUp(row.finalizedTotal + safeNum(inv.total), 2)
    else row.draftTotal = roundHalfUp(row.draftTotal + safeNum(inv.total), 2)
    map.set(inv.clientId, row)
  }
  return [...map.values()].sort((a, b) => b.finalizedTotal - a.finalizedTotal)
}

/** Finalized revenue grouped by issue month. */
export function revenueByMonth(invoices: Invoice[]): MonthRevenueRow[] {
  const map = new Map<string, MonthRevenueRow>()
  for (const inv of invoices) {
    if (inv.status !== 'finalized') continue
    const m = monthOf(inv.issueDate)
    const row = map.get(m) ?? { month: m, total: 0, invoiceCount: 0 }
    row.total = roundHalfUp(row.total + safeNum(inv.total), 2)
    row.invoiceCount += 1
    map.set(m, row)
  }
  return [...map.values()].sort((a, b) => (a.month < b.month ? -1 : 1))
}

/** Billed amount grouped by line type across finalized invoices. */
export function revenueByLineType(invoices: Invoice[]): LineTypeRow[] {
  const map = new Map<InvoiceLineType, number>()
  for (const inv of invoices) {
    if (inv.status !== 'finalized') continue
    for (const l of inv.lineItems) {
      map.set(l.type, roundHalfUp((map.get(l.type) ?? 0) + safeNum(l.amount), 2))
    }
  }
  return [...map.entries()].map(([type, total]) => ({ type, total })).sort((a, b) => b.total - a.total)
}

export interface BilledHoursRow {
  employeeId: string
  employeeName: string
  baseHours: number
  overtimeHours: number
  total: number
}

/** Billed hours per employee across finalized invoices (base/overtime lines only). */
export function billedHoursByEmployee(invoices: Invoice[]): BilledHoursRow[] {
  const map = new Map<string, BilledHoursRow>()
  for (const inv of invoices) {
    if (inv.status !== 'finalized') continue
    for (const l of inv.lineItems) {
      if (l.type !== 'base' && l.type !== 'overtime') continue
      const row = map.get(l.employeeId) ?? { employeeId: l.employeeId, employeeName: l.employeeName, baseHours: 0, overtimeHours: 0, total: 0 }
      if (l.type === 'base') row.baseHours = roundHalfUp(row.baseHours + safeNum(l.quantity), 2)
      else row.overtimeHours = roundHalfUp(row.overtimeHours + safeNum(l.quantity), 2)
      row.total = roundHalfUp(row.total + safeNum(l.amount), 2)
      map.set(l.employeeId, row)
    }
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export interface BillingTotals {
  finalizedTotal: number
  draftTotal: number
  finalizedCount: number
  draftCount: number
}

export function billingTotals(invoices: Invoice[]): BillingTotals {
  let finalizedTotal = 0, draftTotal = 0, finalizedCount = 0, draftCount = 0
  for (const inv of invoices) {
    if (inv.status === 'finalized') { finalizedTotal += safeNum(inv.total); finalizedCount += 1 }
    else { draftTotal += safeNum(inv.total); draftCount += 1 }
  }
  return {
    finalizedTotal: roundHalfUp(finalizedTotal, 2),
    draftTotal: roundHalfUp(draftTotal, 2),
    finalizedCount, draftCount,
  }
}

/** Build a CSV string from rows (array of objects with the given headers). */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
}
