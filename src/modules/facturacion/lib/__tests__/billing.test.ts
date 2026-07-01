import { describe, it, expect, beforeEach } from 'vitest'
import { formatInvoiceNumber } from '../invoiceNumber'
import { resolveRate, findTitleRate } from '../rates'
import { computeInvoiceLines, sumLineItems, makeBonusLine, type RosterEmployee } from '../compute'
import { revenueByClient, revenueByMonth, billedHoursByEmployee, billingTotals } from '../reports'
import { getBillablePayrollRuns, getEmployeeBillingForRuns } from '@/shared/lib/payrollData'
import type { BillingClient, ClientEmployee, TitleRate, Invoice } from '../types'

const baseClient = (over: Partial<BillingClient> = {}): BillingClient => ({
  id: 'c1', name: 'Acme', contactName: '', contactEmail: '', contactPhone: '',
  billingAddress: '', remitToName: '', remitToAddress: '', remitToDetails: '',
  invoicePrefix: 'RM', nextInvoiceSeq: 1, defaultMethod: 'hour', currencyCountry: 'Dominican Republic',
  notes: '', active: true, createdAt: '', updatedAt: '', ...over,
})

const baseAssignment = (over: Partial<ClientEmployee> = {}): ClientEmployee => ({
  id: 'a1', clientId: 'c1', employeeId: 'e1', method: null, baseRateOverride: null,
  otRateOverride: null, fixedAmount: null, percentageRate: null, active: true,
  createdAt: '', updatedAt: '', ...over,
})

const titleRate = (over: Partial<TitleRate> = {}): TitleRate => ({
  id: 't1', clientId: 'c1', title: 'Security Officer', baseRate: 10, otRate: 15,
  createdAt: '', updatedAt: '', ...over,
})

const labels = { basePay: 'Base Pay', overtime: 'Overtime', fixed: 'Fixed', percentage: 'Service Fee' }

// Seed a finalized payroll run into localStorage (the accessor reads spectra_payroll_history).
function seedPayroll(status: 'draft' | 'approved' | 'sent') {
  const run = {
    id: 'run1', startDate: '2026-06-01', endDate: '2026-06-15', frequency: 'biweekly', status,
    country: 'Dominican Republic',
    entries: [
      {
        employee: { id: 'e1', firstName: 'Ana', lastName: 'Peña', jobTitle: 'Security Officer' },
        hours: { regularHours: 80, otHours: 10, holidayHours: 5 },
        calculation: { grossPay: 1000, netPay: 850 },
      },
    ],
    totals: {},
  }
  localStorage.setItem('spectra_payroll_history', JSON.stringify([run]))
}

describe('formatInvoiceNumber', () => {
  it('is client prefix + invoice date as MMDDYYYY', () => {
    expect(formatInvoiceNumber('rm', '2026-02-16')).toBe('RM02162026')
    expect(formatInvoiceNumber('RM', '2026-12-01')).toBe('RM12012026')
    expect(formatInvoiceNumber('', '2026-02-16')).toBe('INV02162026')
  })
})

describe('rate resolution', () => {
  it('finds title rate case-insensitively', () => {
    const rates = [titleRate({ title: 'security officer' })]
    expect(findTitleRate(rates, 'c1', 'Security Officer')?.id).toBe('t1')
    expect(findTitleRate(rates, 'c1', 'Janitor')).toBeUndefined()
  })

  it('uses title rate when no override', () => {
    const r = resolveRate(baseClient(), baseAssignment(), titleRate())
    expect(r.method).toBe('hour')
    expect(r.baseRate).toBe(10)
    expect(r.otRate).toBe(15)
    expect(r.hasBaseRate).toBe(true)
  })

  it('per-employee override wins over title rate', () => {
    const r = resolveRate(baseClient(), baseAssignment({ baseRateOverride: 20, otRateOverride: 30 }), titleRate())
    expect(r.baseRate).toBe(20)
    expect(r.otRate).toBe(30)
  })

  it('per-employee method overrides client default', () => {
    const r = resolveRate(baseClient({ defaultMethod: 'hour' }), baseAssignment({ method: 'fixed', fixedAmount: 500 }), titleRate())
    expect(r.method).toBe('fixed')
    expect(r.fixedAmount).toBe(500)
  })

  it('flags missing rate', () => {
    const r = resolveRate(baseClient(), baseAssignment(), undefined)
    expect(r.hasBaseRate).toBe(false)
    expect(r.baseRate).toBe(0)
  })
})

describe('payrollData accessor', () => {
  beforeEach(() => localStorage.clear())

  it('only returns approved/sent runs', () => {
    seedPayroll('draft')
    expect(getBillablePayrollRuns()).toHaveLength(0)
    seedPayroll('approved')
    expect(getBillablePayrollRuns()).toHaveLength(1)
    seedPayroll('sent')
    expect(getBillablePayrollRuns()).toHaveLength(1)
  })

  it('maps base = regular, overtime = ot + holiday', () => {
    seedPayroll('approved')
    const rows = getEmployeeBillingForRuns(['run1'])
    expect(rows[0].baseHours).toBe(80)
    expect(rows[0].overtimeHours).toBe(15) // 10 OT + 5 holiday
    expect(rows[0].grossPay).toBe(1000)
  })
})

describe('computeInvoiceLines', () => {
  const roster: RosterEmployee[] = [{ id: 'e1', firstName: 'Ana', lastName: 'Peña', jobTitle: 'Security Officer' }]
  beforeEach(() => { localStorage.clear(); seedPayroll('approved') })

  it('hour method → separate base + overtime lines', () => {
    const res = computeInvoiceLines(
      { client: baseClient(), assignments: [baseAssignment()], titleRates: [titleRate()], roster, payrollRunIds: ['run1'] },
      labels,
    )
    const base = res.lineItems.find((l) => l.type === 'base')
    const ot = res.lineItems.find((l) => l.type === 'overtime')
    expect(base?.amount).toBe(800) // 80 × 10
    expect(ot?.amount).toBe(225)   // 15 × 15
    expect(res.employeesWithoutRate).toHaveLength(0)
  })

  it('fixed method → single flat line', () => {
    const res = computeInvoiceLines(
      { client: baseClient({ defaultMethod: 'fixed' }), assignments: [baseAssignment({ fixedAmount: 500 })], titleRates: [], roster, payrollRunIds: ['run1'] },
      labels,
    )
    expect(res.lineItems).toHaveLength(1)
    expect(res.lineItems[0].type).toBe('fixed')
    expect(res.lineItems[0].amount).toBe(500)
  })

  it('percentage method → rate% × gross pay', () => {
    const res = computeInvoiceLines(
      { client: baseClient({ defaultMethod: 'percentage' }), assignments: [baseAssignment({ percentageRate: 15 })], titleRates: [], roster, payrollRunIds: ['run1'] },
      labels,
    )
    expect(res.lineItems).toHaveLength(1)
    expect(res.lineItems[0].amount).toBe(150) // 15% × 1000
  })

  it('reports employees missing a rate', () => {
    const res = computeInvoiceLines(
      { client: baseClient(), assignments: [baseAssignment()], titleRates: [], roster, payrollRunIds: ['run1'] },
      labels,
    )
    expect(res.employeesWithoutRate).toContain('Ana Peña')
  })
})

describe('bonus + totals', () => {
  it('bonus line amount is the total', () => {
    const line = makeBonusLine({ employeeId: 'e1', employeeName: 'Ana', title: 'Officer', label: 'KPI Bonus', quantity: 2, amount: 200 })
    expect(line.type).toBe('bonus')
    expect(line.amount).toBe(200)
    expect(line.rate).toBe(100) // 200 / 2
    expect(line.manual).toBe(true)
  })

  it('sums line items half-up', () => {
    expect(sumLineItems([
      makeBonusLine({ employeeId: 'e1', employeeName: 'A', title: '', label: 'x', quantity: 1, amount: 100.005 }),
      makeBonusLine({ employeeId: 'e1', employeeName: 'A', title: '', label: 'y', quantity: 1, amount: 50 }),
    ])).toBe(150.01)
  })
})

describe('reports', () => {
  const inv = (over: Partial<Invoice>): Invoice => ({
    id: 'i', clientId: 'c1', number: 'RM-0001', status: 'finalized', periodStart: '2026-06-01', periodEnd: '2026-06-15',
    payrollRunIds: [], lineItems: [], subtotal: 0, total: 0, currencyCountry: 'Dominican Republic', notes: '',
    issueDate: '2026-06-20', createdAt: '', updatedAt: '', finalizedAt: '', createdBy: null, clientNameSnapshot: 'Acme', ...over,
  })

  it('revenueByClient splits finalized vs draft', () => {
    const rows = revenueByClient([inv({ total: 1000 }), inv({ id: 'i2', status: 'draft', total: 500 })], () => 'Acme')
    expect(rows[0].finalizedTotal).toBe(1000)
    expect(rows[0].draftTotal).toBe(500)
    expect(rows[0].invoiceCount).toBe(2)
  })

  it('revenueByMonth only counts finalized', () => {
    const rows = revenueByMonth([inv({ total: 1000 }), inv({ id: 'i2', status: 'draft', total: 500 })])
    expect(rows).toHaveLength(1)
    expect(rows[0].month).toBe('2026-06')
    expect(rows[0].total).toBe(1000)
  })

  it('billedHoursByEmployee sums base/overtime line quantities', () => {
    const lineItems = [
      { id: 'l1', employeeId: 'e1', employeeName: 'Ana', title: '', type: 'base' as const, label: 'Base', quantity: 80, rate: 10, amount: 800, manual: false },
      { id: 'l2', employeeId: 'e1', employeeName: 'Ana', title: '', type: 'overtime' as const, label: 'OT', quantity: 15, rate: 15, amount: 225, manual: false },
    ]
    const rows = billedHoursByEmployee([inv({ total: 1025, lineItems })])
    expect(rows[0].baseHours).toBe(80)
    expect(rows[0].overtimeHours).toBe(15)
    expect(rows[0].total).toBe(1025)
  })

  it('billingTotals counts finalized and draft', () => {
    const tot = billingTotals([inv({ total: 1000 }), inv({ id: 'i2', status: 'draft', total: 500 })])
    expect(tot.finalizedTotal).toBe(1000)
    expect(tot.draftTotal).toBe(500)
    expect(tot.finalizedCount).toBe(1)
    expect(tot.draftCount).toBe(1)
  })
})
