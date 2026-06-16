import { describe, it, expect } from 'vitest'
import {
  calculatePayroll,
  calculateAnnualISR,
  roundHalfUp,
  splitOTHours,
} from '../calculations'
import { DEFAULT_FISCAL_PARAMETERS, DEFAULT_PAYROLL_SETTINGS } from '../constants'
import { getDOPayrollRules } from '../rules/do'
import { getUSPayrollRules } from '../rules/us'
import type { CalculationInput } from '../types'

const baseFiscal = DEFAULT_FISCAL_PARAMETERS
const basePayroll = DEFAULT_PAYROLL_SETTINGS

function makeInput(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    employeeId: 'emp-1',
    hourlyRate: 200,
    regularHours: 80,
    otHours: 0,
    holidayHours: 0,
    customDeductions: [],
    rules: getDOPayrollRules(baseFiscal, basePayroll, 'biweekly'),
    frequency: 'biweekly',
    otRatePercent: basePayroll.otRatePercent,
    holidayRatePercent: basePayroll.holidayRatePercent,
    ...overrides,
  }
}

// ─── Test 1: ISR Calculation (annualized from gross × 24) ─────────────────────
describe('ISR Calculation', () => {
  it('employee below RD$416,220/year → ISR = 0', () => {
    // ISR annualized from GROSS × 24 (not grossAfterTSS)
    // hourlyRate=100, 80hrs → gross=8,000 → annual=192,000 < 416,220 → exempt
    const input = makeInput({ hourlyRate: 100, regularHours: 80 })
    const result = calculatePayroll(input)
    expect(result.isrPeriod).toBe(0)
    expect(result.isrCalculated).toBe(0)
  })

  it('employee in bracket 2 (15%) pays correct ISR', () => {
    // gross × 24 must fall in bracket 2: 416,220.01 – 624,329
    // hourlyRate=220, 80hrs → gross=17,600 → annual=422,400 (bracket 2)
    const input = makeInput({ hourlyRate: 220, regularHours: 80 })
    const result = calculatePayroll(input)
    const annualTaxable = result.taxableIncome  // gross × 24
    expect(annualTaxable).toBeGreaterThan(416220)
    expect(annualTaxable).toBeLessThanOrEqual(624329)
    const expectedAnnualISR = roundHalfUp((annualTaxable - 416220.01) * 0.15)
    const expectedPeriodISR = roundHalfUp(expectedAnnualISR / 24)
    expect(result.isrPeriod).toBe(expectedPeriodISR)
    expect(result.isrCalculated).toBe(expectedPeriodISR)
  })

  it('employee in bracket 3 (RD$31,216 + 20%) pays correct ISR', () => {
    // gross × 24 in bracket 3: 624,329.01 – 867,123
    // hourlyRate=350, 80hrs → gross=28,000 → annual=672,000 (bracket 3)
    const input = makeInput({ hourlyRate: 350, regularHours: 80 })
    const result = calculatePayroll(input)
    const annualTaxable = result.taxableIncome
    expect(annualTaxable).toBeGreaterThan(624329)
    expect(annualTaxable).toBeLessThanOrEqual(867123)
    const expectedAnnualISR = roundHalfUp(31216 + (annualTaxable - 624329.01) * 0.20)
    const expectedPeriodISR = roundHalfUp(expectedAnnualISR / 24)
    expect(result.isrPeriod).toBe(expectedPeriodISR)
    expect(result.isrCalculated).toBe(expectedPeriodISR)
  })

  it('Idaly Peña test case: gross=28,000 → ISR=1,697.93/quincena', () => {
    // User-specified test: 28,000 × 24 = 672,000
    // ISR = 31,216 + (672,000 - 624,329.01) × 20% = 40,750.20
    // Per quincena = 40,750.20 / 24 = 1,697.925 → 1,697.93
    const input = makeInput({ hourlyRate: 350, regularHours: 80 })
    const result = calculatePayroll(input)
    expect(result.grossPay).toBe(28000)
    expect(result.taxableIncome).toBe(672000)
    expect(result.isrCalculated).toBe(1697.93)
  })

  it('employee in bracket 4 (RD$79,776 + 25%) pays correct ISR', () => {
    // gross × 24 > 867,123
    // hourlyRate=700, 80hrs → gross=56,000 → annual=1,344,000
    const input = makeInput({ hourlyRate: 700, regularHours: 80 })
    const result = calculatePayroll(input)
    const annualTaxable = result.taxableIncome
    expect(annualTaxable).toBeGreaterThan(867123)
    const expectedAnnualISR = roundHalfUp(79776 + (annualTaxable - 867123.01) * 0.25)
    const expectedPeriodISR = roundHalfUp(expectedAnnualISR / 24)
    expect(result.isrPeriod).toBe(expectedPeriodISR)
    expect(result.isrCalculated).toBe(expectedPeriodISR)
  })
})

// ─── Test 2: Quincena ISR rule ────────────────────────────────────────────────
describe('Quincena ISR Rule (DR biweekly)', () => {
  it('1st quincena (day 1-15): ISR calculated but isrPeriod = 0 (deferred)', () => {
    // periodStart day=1 → 1st quincena → ISR not retained
    const input = makeInput({ hourlyRate: 350, regularHours: 80, periodStart: '2026-03-01' })
    const result = calculatePayroll(input)
    expect(result.isrCalculated).toBe(1697.93)
    expect(result.isrPeriod).toBe(0)
    const expectedNet = roundHalfUp(result.grossPay - result.tssTotal - result.customDeductions)
    expect(result.netPay).toBe(expectedNet)
  })

  it('1st quincena (day 10): ISR still = 0 (any day 1-15)', () => {
    const input = makeInput({ hourlyRate: 350, regularHours: 80, periodStart: '2026-03-10' })
    const result = calculatePayroll(input)
    expect(result.isrPeriod).toBe(0)
    expect(result.isrCalculated).toBeGreaterThan(0)
  })

  it('2nd quincena (day 16-31): ISR retained = isrCalculated × 2', () => {
    // periodStart day=16 → 2nd quincena → retain 2× (covers both halves)
    const input = makeInput({ hourlyRate: 350, regularHours: 80, periodStart: '2026-03-16' })
    const result = calculatePayroll(input)
    expect(result.isrCalculated).toBe(1697.93)
    expect(result.isrPeriod).toBe(roundHalfUp(1697.93 * 2))  // 3,395.86
    const expectedNet = roundHalfUp(result.grossPay - result.tssTotal - result.isrPeriod - result.customDeductions)
    expect(result.netPay).toBe(expectedNet)
  })

  it('weekly payroll: ISR retained normally every period (quincena rule does not apply)', () => {
    const input = makeInput({
      hourlyRate: 350,
      regularHours: 80,
      rules: getDOPayrollRules(baseFiscal, basePayroll, 'weekly'),
      frequency: 'weekly',
      periodStart: '2026-03-01',  // day=1 but weekly → no quincena rule
    })
    const result = calculatePayroll(input)
    expect(result.isrPeriod).toBe(result.isrCalculated)
    expect(result.isrPeriod).toBeGreaterThan(0)
  })

  it('no periodStart: ISR retained normally (backward compat)', () => {
    const input = makeInput({ hourlyRate: 350, regularHours: 80 })
    const result = calculatePayroll(input)
    expect(result.isrPeriod).toBe(result.isrCalculated)
  })
})

// ─── Test 3: TSS caps ─────────────────────────────────────────────────────────
describe('TSS Caps', () => {
  it('AFP cap: gross above 20× minCotizableSalary → AFP base capped', () => {
    const afpCap = baseFiscal.minCotizableSalary * baseFiscal.afpCapMultiplier
    const input = makeInput({ hourlyRate: 3000, regularHours: 80 })
    const result = calculatePayroll(input)
    expect(result.afpBase).toBeLessThanOrEqual(afpCap)
  })

  it('AFP cap: gross exactly at cap → afpBase = cap', () => {
    const afpCap = roundHalfUp(baseFiscal.minCotizableSalary * baseFiscal.afpCapMultiplier)
    const input = makeInput({ hourlyRate: 4085.4, regularHours: 80 })
    const result = calculatePayroll(input)
    expect(result.afpBase).toBeLessThanOrEqual(afpCap)
  })

  it('SFS cap: gross above 10× minCotizableSalary → SFS base capped', () => {
    const sfsCap = roundHalfUp(baseFiscal.minCotizableSalary * baseFiscal.sfsCapMultiplier)
    const input = makeInput({ hourlyRate: 2500, regularHours: 80 })
    const result = calculatePayroll(input)
    expect(result.sfsBase).toBeLessThanOrEqual(sfsCap)
    expect(result.grossPay).toBeGreaterThan(sfsCap)
    expect(result.sfsBase).toBe(sfsCap)
  })
})

// ─── Test 4: OT calculation ───────────────────────────────────────────────────
describe('Overtime Calculation', () => {
  it('50 hrs/week, threshold 44, OT 35%: 44 regular + 6 at 1.35×', () => {
    const { regularHours, otHours } = splitOTHours(50, 44)
    expect(regularHours).toBe(44)
    expect(otHours).toBe(6)

    const hourlyRate = 500
    const input = makeInput({
      hourlyRate,
      regularHours: 44,
      otHours: 6,
      otRatePercent: 35,
    })
    const result = calculatePayroll(input)
    const expectedRegular = roundHalfUp(hourlyRate * 44)
    const expectedOT = roundHalfUp(hourlyRate * 6 * 1.35)
    expect(result.regularPay).toBe(expectedRegular)
    expect(result.otPay).toBe(expectedOT)
    expect(result.grossPay).toBe(roundHalfUp(expectedRegular + expectedOT))
  })
})

// ─── Test 5: Holiday hours ────────────────────────────────────────────────────
describe('Holiday Calculation', () => {
  it('holiday hours at 100% extra → rate = 2.0×', () => {
    const hourlyRate = 400
    const holidayHours = 8
    const input = makeInput({
      hourlyRate,
      regularHours: 0,
      otHours: 0,
      holidayHours,
      holidayRatePercent: 100,
    })
    const result = calculatePayroll(input)
    const expectedHolidayPay = roundHalfUp(hourlyRate * holidayHours * 2.0)
    expect(result.holidayPay).toBe(expectedHolidayPay)
    expect(result.grossPay).toBe(expectedHolidayPay)
  })
})

// ─── Test 6: Custom deductions ────────────────────────────────────────────────
describe('Custom Deductions', () => {
  it('fixed + percentage deductions combined', () => {
    const hourlyRate = 300
    const regularHours = 80
    const grossPay = hourlyRate * regularHours // 24,000
    const input = makeInput({
      hourlyRate,
      regularHours,
      customDeductions: [
        { id: '1', name: 'Loan', type: 'fixed', amount: 1000, recurring: true, active: true },
        { id: '2', name: 'Cooperative', type: 'percentage', amount: 2, recurring: true, active: true },
      ],
    })
    const result = calculatePayroll(input)
    const expectedFixed = 1000
    const expectedPercent = roundHalfUp(grossPay * 0.02)
    const expectedCustomTotal = roundHalfUp(expectedFixed + expectedPercent)
    expect(result.customDeductions).toBe(expectedCustomTotal)
    expect(result.customDeductionsBreakdown).toHaveLength(2)
    expect(result.customDeductionsBreakdown[0].amount).toBe(expectedFixed)
    expect(result.customDeductionsBreakdown[1].amount).toBe(expectedPercent)
  })

  it('inactive deductions are not applied', () => {
    const input = makeInput({
      customDeductions: [
        { id: '1', name: 'Inactive', type: 'fixed', amount: 5000, recurring: false, active: false },
      ],
    })
    const result = calculatePayroll(input)
    expect(result.customDeductions).toBe(0)
    expect(result.customDeductionsBreakdown).toHaveLength(0)
  })
})

// ─── Test 7: Edge Cases ───────────────────────────────────────────────────────
describe('Edge Cases', () => {
  it('employee with 0 hours → payroll = 0, no crash', () => {
    const input = makeInput({ regularHours: 0, otHours: 0, holidayHours: 0 })
    const result = calculatePayroll(input)
    expect(result.grossPay).toBe(0)
    expect(result.netPay).toBe(0)
    expect(result.totalDeductions).toBe(0)
    expect(result.isrPeriod).toBe(0)
    expect(result.isrCalculated).toBe(0)
    expect(result.afpAmount).toBe(0)
    expect(result.sfsAmount).toBe(0)
  })

  it('hourly rate = 0 → payroll = 0, no crash', () => {
    const input = makeInput({ hourlyRate: 0, regularHours: 80 })
    const result = calculatePayroll(input)
    expect(result.grossPay).toBe(0)
    expect(result.netPay).toBe(0)
  })

  it('net pay calculation is numerically valid (no NaN)', () => {
    const input = makeInput({
      hourlyRate: 50,
      regularHours: 1,
      customDeductions: [
        { id: '1', name: 'Big deduction', type: 'fixed', amount: 10000, recurring: true, active: true },
      ],
    })
    const result = calculatePayroll(input)
    expect(typeof result.netPay).toBe('number')
    expect(isNaN(result.netPay)).toBe(false)
  })
})

// ─── Test 8: Rounding ─────────────────────────────────────────────────────────
describe('Rounding', () => {
  it('roundHalfUp rounds 2.5 to 3, 2.45 to 2.45, 1.005 to 1.01', () => {
    expect(roundHalfUp(2.5, 0)).toBe(3)
    expect(roundHalfUp(2.45, 2)).toBe(2.45)
    expect(roundHalfUp(1.005, 2)).toBe(1.01)
    expect(roundHalfUp(1234.5678, 2)).toBe(1234.57)
  })

  it('all monetary results have at most 2 decimal places', () => {
    const input = makeInput({ hourlyRate: 333.33, regularHours: 43 })
    const result = calculatePayroll(input)
    const checkDecimals = (val: number) => {
      const str = val.toString()
      const parts = str.split('.')
      if (parts.length === 2) {
        expect(parts[1].length).toBeLessThanOrEqual(2)
      }
    }
    checkDecimals(result.grossPay)
    checkDecimals(result.afpAmount)
    checkDecimals(result.sfsAmount)
    checkDecimals(result.isrPeriod)
    checkDecimals(result.isrCalculated)
    checkDecimals(result.netPay)
  })
})

// ─── Test 9: calculateAnnualISR directly ─────────────────────────────────────
describe('calculateAnnualISR', () => {
  it('amount = 0 → ISR = 0', () => {
    expect(calculateAnnualISR(0, baseFiscal.isrBrackets)).toBe(0)
  })

  it('amount = 416,220 → ISR = 0 (exactly at bracket 1 max)', () => {
    expect(calculateAnnualISR(416220, baseFiscal.isrBrackets)).toBe(0)
  })

  it('amount = 520,000 → 15% of (520,000 - 416,220.01)', () => {
    const expected = roundHalfUp((520000 - 416220.01) * 0.15)
    expect(calculateAnnualISR(520000, baseFiscal.isrBrackets)).toBe(expected)
  })

  it('amount = 672,000 → bracket 3: 31,216 + 20% of excess (Idaly Peña annual)', () => {
    const expected = roundHalfUp(31216 + (672000 - 624329.01) * 0.20)
    expect(calculateAnnualISR(672000, baseFiscal.isrBrackets)).toBe(expected)
    expect(expected).toBe(40750.20)
  })

  it('amount = 900,000 → bracket 4: 79,776 + 25% of excess', () => {
    const expected = roundHalfUp(79776 + (900000 - 867123.01) * 0.25)
    expect(calculateAnnualISR(900000, baseFiscal.isrBrackets)).toBe(expected)
  })
})

// ─── Test 10: US Payroll Rules ────────────────────────────────────────────────
describe('US Payroll Rules', () => {
  it('Medicare + Social Security computed correctly for a US employee', () => {
    // US: hourlyRate=50, 80hrs → gross=4,000
    // Medicare 1.45% (no cap): 4,000 × 0.0145 = 58.00
    // Social Security 6.2%, cap = 168600/24 = 7025.00 per period; 4000 < 7025 so no cap
    // SS: 4,000 × 0.062 = 248.00
    const usRules = getUSPayrollRules('biweekly')
    const input: CalculationInput = {
      employeeId: 'us-emp-1',
      hourlyRate: 50,
      regularHours: 80,
      otHours: 0,
      holidayHours: 0,
      customDeductions: [],
      rules: usRules,
      frequency: 'biweekly',
      otRatePercent: 35,
      holidayRatePercent: 100,
    }
    const result = calculatePayroll(input)
    expect(result.grossPay).toBe(4000)
    expect(result.sfsAmount).toBe(roundHalfUp(4000 * 0.0145))   // Medicare = 58.00
    expect(result.afpAmount).toBe(roundHalfUp(4000 * 0.062))    // SS = 248.00
  })

  it('US payroll: income tax retained every period (no quincena rule)', () => {
    // US: hourlyRate=100, 80hrs → gross=8,000 → annual=192,000
    // Federal income tax: 1,160 + (192,000-11,600) × 12% = 1,160 + 21,648 = 22,808 annual → 22,808/24 ≈ 950.33/period
    const usRules = getUSPayrollRules('biweekly')
    const input: CalculationInput = {
      employeeId: 'us-emp-2',
      hourlyRate: 100,
      regularHours: 80,
      otHours: 0,
      holidayHours: 0,
      customDeductions: [],
      rules: usRules,
      frequency: 'biweekly',
      periodStart: '2026-03-01',  // day=1 — would trigger 1st quincena for DR but NOT for US
      otRatePercent: 35,
      holidayRatePercent: 100,
    }
    const result = calculatePayroll(input)
    // ISR should be retained normally (not 0 like DR 1st quincena)
    expect(result.isrPeriod).toBe(result.isrCalculated)
    expect(result.isrPeriod).toBeGreaterThan(0)
    // US rules country is 'United States', so isDR=false, no quincena applied
    expect(usRules.country).toBe('United States')
  })
})
