import { describe, it, expect } from 'vitest'
import { toInvoiceRows, toEmployeeHours } from '../invoiceView'
import type { InvoiceLineItem } from '../types'

const line = (o: Partial<InvoiceLineItem>): InvoiceLineItem => ({
  id: Math.random().toString(36).slice(2), employeeId: 'e', employeeName: 'E', title: '',
  type: 'base', label: 'Base Pay', quantity: 0, rate: 0, amount: 0, manual: false, ...o,
})

const lines: InvoiceLineItem[] = [
  line({ employeeId: 'e1', employeeName: 'Ana', title: 'Marketing Coaches', type: 'base', label: 'Base Pay', quantity: 40, rate: 9, amount: 360 }),
  line({ employeeId: 'e2', employeeName: 'Bob', title: 'Marketing Coaches', type: 'base', label: 'Base Pay', quantity: 30, rate: 9, amount: 270 }),
  line({ employeeId: 'e2', employeeName: 'Bob', title: 'Marketing Coaches', type: 'overtime', label: 'Overtime Differential', quantity: 4, rate: 4.5, amount: 18 }),
  line({ employeeId: 'e1', employeeName: 'Ana', title: 'Marketing Coaches', type: 'bonus', label: 'KPI Bonus', quantity: 1, rate: 100, amount: 100, manual: true }),
]

describe('toInvoiceRows', () => {
  it('aggregates base pay by role+rate into one line', () => {
    const rows = toInvoiceRows(lines)
    const base = rows.filter((r) => r.payClass === 'Base Pay')
    expect(base).toHaveLength(1)
    expect(base[0].hours).toBe(70)          // 40 + 30
    expect(base[0].amount).toBe(630)        // 360 + 270
    expect(base[0].description).toBe('Marketing Coaches')
    expect(base[0].rate).toBe(9)
  })

  it('keeps overtime and bonuses as their own rows, ordered base→ot→bonus', () => {
    const rows = toInvoiceRows(lines)
    expect(rows.map((r) => r.payClass)).toEqual(['Base Pay', 'Overtime Differential', 'KPI Bonus'])
    const bonus = rows[2]
    expect(bonus.description).toBe('Ana')   // bonus shows the employee
    expect(bonus.hours).toBeNull()
    expect(bonus.quantity).toBe(1)
    expect(bonus.amount).toBe(100)
  })
})

describe('toEmployeeHours', () => {
  it('sums base + overtime per employee for the appendix', () => {
    const hrs = toEmployeeHours(lines)
    const ana = hrs.find((h) => h.employeeName === 'Ana')!
    const bob = hrs.find((h) => h.employeeName === 'Bob')!
    expect(ana.baseHours).toBe(40)
    expect(ana.overtimeHours).toBe(0)
    expect(ana.totalWorked).toBe(40)
    expect(bob.baseHours).toBe(30)
    expect(bob.overtimeHours).toBe(4)
    expect(bob.totalWorked).toBe(34)
  })
})
