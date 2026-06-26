import { describe, it, expect } from 'vitest'
import { calculatePayroll } from '../calculations'
import { getPayrollRules } from '../rules'
import { COUNTRY_FISCAL_DEFAULTS } from '@/shared/lib/countryFiscalDefaults'
import { DEFAULT_FISCAL_PARAMETERS, DEFAULT_PAYROLL_SETTINGS } from '../constants'
import type { CalculationInput } from '../types'

const fiscal = DEFAULT_FISCAL_PARAMETERS
const payroll = DEFAULT_PAYROLL_SETTINGS
const configs = COUNTRY_FISCAL_DEFAULTS

function salaryInput(country: string, monthly: number, configsOverride = configs): CalculationInput {
  return {
    employeeId: 'e1',
    payType: 'Salary',
    hourlyRate: monthly, // full_month salary = monthly amount
    regularHours: 0,
    otHours: 0,
    holidayHours: 0,
    customDeductions: [],
    rules: getPayrollRules(country, 'full_month', fiscal, payroll, configsOverride),
    frequency: 'full_month',
  }
}

describe('Philippines deductions (SSS + PhilHealth + Pag-IBIG)', () => {
  it('sums the three statutory deductions with their caps', () => {
    const r = calculatePayroll(salaryInput('Philippines', 20000))
    // SSS 4.5% of 20,000 = 900; PhilHealth 2.5% of 20,000 = 500; Pag-IBIG 2% of min(20k,10k)=10k = 200
    expect(r.deductionsBreakdown.map((d) => d.name)).toEqual(['SSS', 'PhilHealth', 'Pag-IBIG'])
    expect(r.deductionsBreakdown.map((d) => d.amount)).toEqual([900, 500, 200])
    expect(r.tssTotal).toBe(1600)
    expect(r.isrPeriod).toBe(0)         // annual 240,000 < 250,000 → exempt
    expect(r.netPay).toBe(18400)
  })
})

describe('toggling a deduction off', () => {
  it('excludes a disabled deduction from the total', () => {
    const ph = configs.philippines
    const off = {
      ...configs,
      philippines: {
        ...ph,
        deductions: ph.deductions.map((d) => (d.id === 'pagibig' ? { ...d, enabled: false } : d)),
      },
    }
    const r = calculatePayroll(salaryInput('Philippines', 20000, off))
    expect(r.deductionsBreakdown.map((d) => d.name)).toEqual(['SSS', 'PhilHealth'])
    expect(r.tssTotal).toBe(1400)       // 900 + 500, no Pag-IBIG
  })
})

describe('Trinidad and Tobago flat-amount deduction', () => {
  it('applies the Health Surcharge as a fixed per-period amount', () => {
    const r = calculatePayroll(salaryInput('Trinidad and Tobago', 10000))
    // NIS 5.4% of 10,000 = 540; Health Surcharge flat 35.75
    const nis = r.deductionsBreakdown.find((d) => d.name === 'NIS')
    const hs = r.deductionsBreakdown.find((d) => d.name === 'Health Surcharge')
    expect(nis?.amount).toBe(540)
    expect(hs?.amount).toBe(35.75)
    expect(hs?.rate).toBe(0)
    expect(r.tssTotal).toBe(575.75)
  })
})

describe('Kenya deductions (NSSF + SHIF + Housing Levy)', () => {
  it('applies all three with the NSSF cap', () => {
    const r = calculatePayroll(salaryInput('Kenya', 100000))
    // NSSF 6% capped at base 72,000 → 4,320; SHIF 2.75% of 100,000 = 2,750; Housing 1.5% of 100,000 = 1,500
    expect(r.deductionsBreakdown.find((d) => d.name === 'NSSF')?.amount).toBe(4320)
    expect(r.deductionsBreakdown.find((d) => d.name === 'SHIF')?.amount).toBe(2750)
    expect(r.deductionsBreakdown.find((d) => d.name === 'Housing Levy')?.amount).toBe(1500)
  })
})

describe('unknown country', () => {
  it('falls back to zero statutory deductions', () => {
    const r = calculatePayroll(salaryInput('Narnia', 50000))
    expect(r.deductionsBreakdown).toEqual([])
    expect(r.tssTotal).toBe(0)
  })
})
