import { describe, it, expect } from 'vitest'
import {
  calculatePayroll,
  calculateAnnualISR,
  findFirstFortnightGross,
  roundHalfUp,
  safeNum,
  standardPeriodHours,
  formatCurrency,
  formatCurrencyWithSymbol,
  splitOTHours,
} from '../calculations'
import { DEFAULT_FISCAL_PARAMETERS, DEFAULT_PAYROLL_SETTINGS } from '../constants'
import { getDOPayrollRules } from '../rules/do'
import { getUSPayrollRules } from '../rules/us'
import type { CalculationInput } from '../types'

const baseFiscal = DEFAULT_FISCAL_PARAMETERS
const basePayroll = DEFAULT_PAYROLL_SETTINGS

function makeInput(overrides: Partial<CalculationInput> = {}): CalculationInput {
  const frequency = overrides.frequency ?? 'biweekly'
  return {
    employeeId: 'emp-1',
    hourlyRate: 200,
    regularHours: 80,
    otHours: 0,
    holidayHours: 0,
    customDeductions: [],
    rules: getDOPayrollRules(baseFiscal, basePayroll, frequency),
    frequency,
    otRatePercent: basePayroll.otRatePercent,
    holidayRatePercent: basePayroll.holidayRatePercent,
    ...overrides,
  }
}

// ─── Test 1: ISR Calculation (no periodStart → per-period, gross-annualized) ───
describe('ISR Calculation (per-period, gross-annualized fallback)', () => {
  it('employee below RD$416,220/year → ISR = 0', () => {
    // hourlyRate=100, 80hrs → gross=8,000 → annual=192,000 < 416,220 → exempt
    const input = makeInput({ hourlyRate: 100, regularHours: 80 })
    const result = calculatePayroll(input)
    expect(result.isrPeriod).toBe(0)
    expect(result.isrCalculated).toBe(0)
  })

  it('employee in bracket 2 (15%) pays correct ISR', () => {
    // hourlyRate=220, 80hrs → gross=17,600 → annual=422,400 (bracket 2)
    const input = makeInput({ hourlyRate: 220, regularHours: 80 })
    const result = calculatePayroll(input)
    const annualTaxable = result.taxableIncome
    expect(annualTaxable).toBeGreaterThan(416220)
    expect(annualTaxable).toBeLessThanOrEqual(624329)
    const expectedPeriodISR = roundHalfUp(calculateAnnualISR(annualTaxable, baseFiscal.isrBrackets) / 24)
    expect(result.isrPeriod).toBe(expectedPeriodISR)
    expect(result.isrCalculated).toBe(expectedPeriodISR)
  })

  it('employee in bracket 3 (20%) pays correct ISR', () => {
    // hourlyRate=350, 80hrs → gross=28,000 → annual=672,000 (bracket 3)
    const input = makeInput({ hourlyRate: 350, regularHours: 80 })
    const result = calculatePayroll(input)
    const annualTaxable = result.taxableIncome
    expect(annualTaxable).toBeGreaterThan(624329)
    expect(annualTaxable).toBeLessThanOrEqual(867123)
    const expectedPeriodISR = roundHalfUp(calculateAnnualISR(annualTaxable, baseFiscal.isrBrackets) / 24)
    expect(result.isrPeriod).toBe(expectedPeriodISR)
    expect(result.isrCalculated).toBe(expectedPeriodISR)
  })

  it('employee in bracket 4 (25%) pays correct ISR', () => {
    // hourlyRate=700, 80hrs → gross=56,000 → annual=1,344,000
    const input = makeInput({ hourlyRate: 700, regularHours: 80 })
    const result = calculatePayroll(input)
    const annualTaxable = result.taxableIncome
    expect(annualTaxable).toBeGreaterThan(867123)
    const expectedPeriodISR = roundHalfUp(calculateAnnualISR(annualTaxable, baseFiscal.isrBrackets) / 24)
    expect(result.isrPeriod).toBe(expectedPeriodISR)
    expect(result.isrCalculated).toBe(expectedPeriodISR)
  })
})

// ─── Test 2: Monthly quincena ISR rule (the DGII fix) ─────────────────────────
describe('Quincena Monthly ISR Rule (DR biweekly)', () => {
  it('1st quincena (day 1-15): ISR deferred → isrPeriod = 0, isrDeferred = true', () => {
    const input = makeInput({ hourlyRate: 350, regularHours: 80, periodStart: '2026-03-01' })
    const result = calculatePayroll(input)
    expect(result.isrPeriod).toBe(0)
    expect(result.isrDeferred).toBe(true)
    expect(result.isrMonthlyBase).toBe(0)
    const expectedNet = roundHalfUp(result.grossPay - result.tssTotal - result.customDeductions)
    expect(result.netPay).toBe(expectedNet)
  })

  it('1st quincena (day 10): still deferred for any day 1-15', () => {
    const input = makeInput({ hourlyRate: 350, regularHours: 80, periodStart: '2026-03-10' })
    const result = calculatePayroll(input)
    expect(result.isrPeriod).toBe(0)
    expect(result.isrDeferred).toBe(true)
  })

  it('Idaly Peña 2nd quincena (verified): monthly base 57,959.44 → ISR 3,787.77', () => {
    // 1st fortnight gross 28,000 (net 26,345.20); 2nd fortnight gross 33,600 (420×80, net 31,614.24)
    // base_mensual = 57,959.44 → ×12 = 695,513.28 → ISR anual 45,453.21 → /12 = 3,787.77
    const input = makeInput({
      hourlyRate: 420,
      regularHours: 80,
      periodStart: '2026-03-16',
      firstFortnightGross: 28000,
    })
    const result = calculatePayroll(input)
    expect(result.grossPay).toBe(33600)
    expect(result.isrDeferred).toBe(false)
    expect(result.isrMonthlyBase).toBe(57959.44)
    expect(result.taxableIncome).toBe(695513.28)
    expect(result.isrMonthly).toBe(3787.77)
    expect(result.isrPeriod).toBe(3787.77)
  })

  it('2nd quincena without a saved 1st fortnight → assumes equal fortnights', () => {
    const input = makeInput({ hourlyRate: 420, regularHours: 80, periodStart: '2026-03-16' })
    const result = calculatePayroll(input)
    const net = roundHalfUp(result.grossPay - result.tssTotal)
    expect(result.isrMonthlyBase).toBe(roundHalfUp(net * 2))
    expect(result.isrPeriod).toBeGreaterThan(0)
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
    expect(result.isrDeferred).toBe(false)
  })

  it('no periodStart: ISR retained normally (backward compat)', () => {
    const input = makeInput({ hourlyRate: 350, regularHours: 80 })
    const result = calculatePayroll(input)
    expect(result.isrPeriod).toBe(result.isrCalculated)
    expect(result.isrDeferred).toBe(false)
  })

  it('pending vacation ISR is collected on the 2nd fortnight only, added to deductions', () => {
    const second = calculatePayroll(makeInput({ hourlyRate: 350, regularHours: 80, periodStart: '2026-03-16', pendingVacationIsr: 1000 }))
    expect(second.vacationIsr).toBe(1000)
    expect(second.totalDeductions).toBe(roundHalfUp(second.tssTotal + second.isrPeriod + second.vacationIsr + second.customDeductions))

    const first = calculatePayroll(makeInput({ hourlyRate: 350, regularHours: 80, periodStart: '2026-03-01', pendingVacationIsr: 1000 }))
    expect(first.vacationIsr).toBe(0) // 1st quincena does not collect ISR
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
  it('worked holiday hours count as regular hours + a 100% bonus (not double rate)', () => {
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
    // Regular pay covers the worked holiday hours; the holiday line is the bonus only.
    expect(result.regularPay).toBe(roundHalfUp(hourlyRate * holidayHours))      // 3,200
    expect(result.holidayPay).toBe(roundHalfUp(hourlyRate * holidayHours * 1.0)) // 3,200 bonus
    expect(result.grossPay).toBe(roundHalfUp(hourlyRate * holidayHours * 2.0))   // 6,400 total
  })

  it('Idaly Peña June 1-15 2026 (verified paystub): holiday bonus is non-cotizable', () => {
    // 88 tracked hours incl. 8 on a holiday (Corpus Christi), rate RD$350, 1st quincena.
    const input = makeInput({
      hourlyRate: 350,
      regularHours: 80,        // disjoint buckets: 80 regular + 8 holiday = 88 worked
      holidayHours: 8,
      holidayRatePercent: 100,
      periodStart: '2026-06-01', // 1st quincena → ISR deferred
    })
    const r = calculatePayroll(input)
    expect(r.regularPay).toBe(30800)   // 88 × 350
    expect(r.holidayPay).toBe(2800)    // 8 × 350 × 100% bonus
    expect(r.grossPay).toBe(33600)     // 30,800 + 2,800
    // AFP + SFS computed on the cotizable base 30,800 (excludes the holiday bonus)
    expect(r.afpAmount).toBe(883.96)   // 30,800 × 2.87%
    expect(r.sfsAmount).toBe(936.32)   // 30,800 × 3.04%
    expect(r.isrPeriod).toBe(0)        // 1st quincena defers ISR
    expect(r.netPay).toBe(31779.72)    // 33,600 − 1,820.28
  })
})

// ─── Full month frequency (DR) ────────────────────────────────────────────────
describe('Full-month DR run', () => {
  it('salaried employee gets the FULL monthly salary (not half)', () => {
    const full = makeInput({
      payType: 'Salary', hourlyRate: 50000, regularHours: 0,
      frequency: 'full_month', periodStart: '2026-03-01',
    })
    const half = makeInput({
      payType: 'Salary', hourlyRate: 50000, regularHours: 0,
      periodStart: '2026-03-01', // biweekly 1st quincena → half
    })
    expect(calculatePayroll(full).grossPay).toBe(50000)   // whole month
    expect(calculatePayroll(half).grossPay).toBe(25000)   // monthly / 2
  })

  it('retains the whole month ISR (not deferred like a 1st quincena)', () => {
    const r = calculatePayroll(makeInput({
      payType: 'Salary', hourlyRate: 90000, regularHours: 0,
      frequency: 'full_month', periodStart: '2026-03-01',
    }))
    expect(r.isrDeferred).toBe(false)
    expect(r.isrPeriod).toBeGreaterThan(0)
    // monthly base = net of the full month; annual = ×12
    expect(r.taxableIncome).toBe(roundHalfUp(r.isrMonthlyBase * 12))
  })

  it('biweekly 1st quincena still defers ISR', () => {
    const r = calculatePayroll(makeInput({
      hourlyRate: 420, regularHours: 80, periodStart: '2026-03-01',
    }))
    expect(r.isrDeferred).toBe(true)
    expect(r.isrPeriod).toBe(0)
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

  it('amount = 672,000 → bracket 3: 31,216.35 + 20% of excess (Idaly Peña annual)', () => {
    // 31,216.35 + (672,000 - 624,329) × 0.20 = 31,216.35 + 9,534.20 = 40,750.55
    expect(calculateAnnualISR(672000, baseFiscal.isrBrackets)).toBe(40750.55)
  })

  it('amount = 900,000 → bracket 4: 79,776.35 + 25% of excess', () => {
    // 79,776.35 + (900,000 - 867,123) × 0.25 = 79,776.35 + 8,219.25 = 87,995.60
    expect(calculateAnnualISR(900000, baseFiscal.isrBrackets)).toBe(87995.60)
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

// ─── Test 11: findFirstFortnightGross helper ──────────────────────────────────
describe('findFirstFortnightGross', () => {
  const firstQuincena = {
    id: 'p1',
    startDate: '2026-03-01',
    endDate: '2026-03-15',
    frequency: 'biweekly',
    status: 'approved',
    country: 'Dominican Republic',
    entries: [
      { employee: { id: 'emp-1' }, hours: {}, calculation: { grossPay: 28000 } },
    ],
    totals: {},
  }

  it('returns the 1st-fortnight gross for same month/country/employee', () => {
    const history = [firstQuincena] as never
    expect(findFirstFortnightGross(history, 'Dominican Republic', '2026-03-16', 'emp-1')).toBe(28000)
  })

  it('returns undefined when no matching 1st fortnight is saved', () => {
    expect(findFirstFortnightGross([], 'Dominican Republic', '2026-03-16', 'emp-1')).toBeUndefined()
  })

  it('ignores periods from a different month', () => {
    const history = [firstQuincena] as never
    expect(findFirstFortnightGross(history, 'Dominican Republic', '2026-04-16', 'emp-1')).toBeUndefined()
  })
})

// ─── Test 12: Salary payType ──────────────────────────────────────────────────
describe('Salary payType', () => {
  it('salary gross = monthly × 12 / periods (biweekly → monthly/2), hours ignored', () => {
    // monthly salary RD$50,000 → biweekly period gross = 25,000
    const input = makeInput({ payType: 'Salary', hourlyRate: 50000, regularHours: 0, otHours: 0, holidayHours: 0 })
    const result = calculatePayroll(input)
    expect(result.grossPay).toBe(25000)
    expect(result.afpAmount).toBe(roundHalfUp(25000 * 0.0287))   // 717.50
    expect(result.sfsAmount).toBe(roundHalfUp(25000 * 0.0304))   // 760.00
    expect(result.netPay).toBeGreaterThan(0)
  })

  it('salary pay is fixed regardless of hours entered', () => {
    const a = calculatePayroll(makeInput({ payType: 'Salary', hourlyRate: 50000, regularHours: 96 }))
    const b = calculatePayroll(makeInput({ payType: 'Salary', hourlyRate: 50000, regularHours: 40 }))
    expect(a.grossPay).toBe(25000)
    expect(b.grossPay).toBe(25000)
  })

  it('salary with 0 hours still flows through (not zeroed like hourly)', () => {
    const salary = calculatePayroll(makeInput({ payType: 'Salary', hourlyRate: 50000, regularHours: 0 }))
    const hourly = calculatePayroll(makeInput({ payType: 'Hourly', hourlyRate: 50000, regularHours: 0 }))
    expect(salary.grossPay).toBe(25000)
    expect(hourly.grossPay).toBe(0)  // hourly with no hours earns nothing
  })
})

// ─── Test 13: NaN safety (no "unsupported number: NaN") ───────────────────────
describe('NaN safety', () => {
  it('safeNum coerces null/undefined/NaN/Infinity to 0', () => {
    expect(safeNum(null)).toBe(0)
    expect(safeNum(undefined)).toBe(0)
    expect(safeNum(NaN)).toBe(0)
    expect(safeNum(Infinity)).toBe(0)
    expect(safeNum('abc')).toBe(0)
    expect(safeNum(12.5)).toBe(12.5)
  })

  it('NaN/undefined numeric inputs never produce NaN in the result', () => {
    const result = calculatePayroll(makeInput({
      hourlyRate: NaN as unknown as number,
      regularHours: undefined as unknown as number,
      otHours: NaN as unknown as number,
    }))
    for (const v of Object.values(result)) {
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true)
    }
    expect(result.grossPay).toBe(0)
  })

  it('formatCurrency renders 0.00 for NaN/undefined instead of "NaN"', () => {
    expect(formatCurrency(NaN)).toBe('RD$ 0.00')
    expect(formatCurrency(undefined as unknown as number)).toBe('RD$ 0.00')
    expect(formatCurrencyWithSymbol(NaN, 'MX$')).toBe('MX$ 0.00')
  })

  it('standardPeriodHours counts workdays × 8 (1st fortnight March 2026)', () => {
    // 2026-03-01..15: workdays Mon-Fri. March 1 2026 is a Sunday.
    const hrs = standardPeriodHours('2026-03-01', '2026-03-15')
    expect(hrs).toBeGreaterThan(0)
    expect(hrs % 8).toBe(0)
  })
})

// ─── Test 14: Night shift 15% incentive ───────────────────────────────────────
describe('Night Shift Incentive', () => {
  const percent = { nightStartTime: '21:00', mixedThresholdMode: 'percent' as const, mixedThresholdHours: 3.5 }
  const byHours = { nightStartTime: '21:00', mixedThresholdMode: 'hours' as const, mixedThresholdHours: 3.5 }

  it('partial (≤50%): 15% applies only to night hours, additive to gross', () => {
    const r = calculatePayroll(makeInput({ hourlyRate: 200, regularHours: 80, nightHours: 20, nightShift: percent }))
    expect(r.nightIncentiveHours).toBe(20)
    expect(r.nightIncentiveAmount).toBe(roundHalfUp(20 * 200 * 0.15)) // 600
    expect(r.grossPay).toBe(roundHalfUp(80 * 200 + 600))               // 16,600
  })

  it('mixed >50% (percent mode): 15% applies to ALL worked hours', () => {
    const r = calculatePayroll(makeInput({ hourlyRate: 200, regularHours: 80, nightHours: 50, nightShift: percent }))
    expect(r.nightIncentiveHours).toBe(80)
    expect(r.nightIncentiveAmount).toBe(roundHalfUp(80 * 200 * 0.15)) // 2,400
  })

  it('hours mode: night > X → treated as fully nocturnal (all hours)', () => {
    const r = calculatePayroll(makeInput({ hourlyRate: 200, regularHours: 80, nightHours: 5, nightShift: byHours }))
    expect(r.nightIncentiveHours).toBe(80)
  })

  it('hours mode: night ≤ X → only night hours', () => {
    const r = calculatePayroll(makeInput({ hourlyRate: 200, regularHours: 80, nightHours: 3, nightShift: byHours }))
    expect(r.nightIncentiveHours).toBe(3)
  })

  it('no nightShift config → no incentive', () => {
    const r = calculatePayroll(makeInput({ hourlyRate: 200, regularHours: 80, nightHours: 40 }))
    expect(r.nightIncentiveAmount).toBe(0)
    expect(r.grossPay).toBe(roundHalfUp(80 * 200))
  })

  it('salary employees get no night incentive', () => {
    const r = calculatePayroll(makeInput({ payType: 'Salary', hourlyRate: 50000, regularHours: 0, nightHours: 20, nightShift: percent }))
    expect(r.nightIncentiveAmount).toBe(0)
    expect(r.grossPay).toBe(25000)
  })

  it('night incentive is subject to TSS (included in gross before AFP/SFS)', () => {
    const r = calculatePayroll(makeInput({ hourlyRate: 200, regularHours: 80, nightHours: 20, nightShift: percent }))
    expect(r.afpAmount).toBe(roundHalfUp(r.grossPay * 0.0287))
    expect(r.sfsAmount).toBe(roundHalfUp(r.grossPay * 0.0304))
  })
})
