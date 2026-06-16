import type { ISRBracket } from '@/types'
import type { CalculationInput, CalculationResult } from './types'

/**
 * Half-up rounding to n decimal places.
 * JavaScript's default rounding can give wrong results for monetary values.
 */
export function roundHalfUp(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Format a monetary value as RD$ 1,234.56
 */
export function formatCurrency(value: number): string {
  const rounded = roundHalfUp(value, 2)
  return `RD$ ${rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Format a monetary value with a given currency symbol, e.g. MX$ 1,234.56
 */
export function formatCurrencyWithSymbol(value: number, symbol: string): string {
  const rounded = roundHalfUp(value, 2)
  return `${symbol} ${rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Calculate hourly earnings (regular, OT, holiday).
 */
function calculateHourlyEarnings(
  hourlyRate: number,
  regularHours: number,
  otHours: number,
  holidayHours: number,
  otRatePercent: number,
  holidayRatePercent: number,
): { regularPay: number; otPay: number; holidayPay: number; grossPay: number } {
  const regularPay = roundHalfUp(hourlyRate * regularHours)
  const otMultiplier = 1 + otRatePercent / 100
  const holidayMultiplier = 1 + holidayRatePercent / 100
  const otPay = roundHalfUp(hourlyRate * otHours * otMultiplier)
  const holidayPay = roundHalfUp(hourlyRate * holidayHours * holidayMultiplier)
  const grossPay = roundHalfUp(regularPay + otPay + holidayPay)
  return { regularPay, otPay, holidayPay, grossPay }
}

/**
 * Calculate annual ISR from annualized taxable income.
 * Applies DGII 4-bracket scale.
 */
export function calculateAnnualISR(annualTaxable: number, brackets: ISRBracket[]): number {
  if (annualTaxable <= 0) return 0

  const sortedBrackets = [...brackets].sort((a, b) => a.minAmount - b.minAmount)

  for (const bracket of sortedBrackets) {
    const isInBracket =
      annualTaxable >= bracket.minAmount &&
      (bracket.maxAmount === null || annualTaxable <= bracket.maxAmount)

    if (isInBracket) {
      if (bracket.rate === 0) return 0
      const excess = roundHalfUp(annualTaxable - bracket.minAmount + 0.01)
      return roundHalfUp(bracket.fixedAmount + excess * (bracket.rate / 100))
    }
  }

  return 0
}

/**
 * Calculate custom deductions (fixed + percentage of gross).
 * Only active deductions are applied.
 */
function calculateCustomDeductions(
  grossPay: number,
  deductions: CalculationInput['customDeductions'],
): { breakdown: Array<{ name: string; amount: number }>; total: number } {
  const breakdown: Array<{ name: string; amount: number }> = []

  for (const deduction of deductions) {
    if (!deduction.active) continue
    let amount: number
    if (deduction.type === 'fixed') {
      amount = roundHalfUp(deduction.amount)
    } else {
      amount = roundHalfUp(grossPay * (deduction.amount / 100))
    }
    breakdown.push({ name: deduction.name, amount })
  }

  const total = roundHalfUp(breakdown.reduce((sum, d) => sum + d.amount, 0))
  return { breakdown, total }
}

/**
 * Main payroll calculation function.
 * Pure function — no side effects, no UI dependencies.
 *
 * DR biweekly quincena ISR rule (only when rules.country includes 'dominican'):
 *   1st quincena (startDay=1-15): calculate ISR but retain 0 (defer to 2nd).
 *   2nd quincena (startDay 16-31): retain isrCalculated × 2 (covers both halves).
 *   US and other countries: retain ISR every period normally.
 *   Weekly / no periodStart: retain ISR every period normally.
 */
export function calculatePayroll(input: CalculationInput): CalculationResult {
  const {
    hourlyRate,
    regularHours,
    otHours,
    holidayHours,
    rules,
    frequency,
    otRatePercent = 35,
    holidayRatePercent = 100,
  } = input

  // Detect quincena from period start date (DR biweekly rule only)
  const isDR = rules.country.toLowerCase().includes('dominican')
  let quincena: 1 | 2 | null = null
  if (isDR && frequency === 'biweekly' && input.periodStart) {
    const day = new Date(input.periodStart + 'T00:00:00').getDate()
    quincena = day <= 15 ? 1 : 2
  }

  if (hourlyRate <= 0 || (regularHours + otHours + holidayHours) === 0) {
    return {
      regularPay: 0,
      otPay: 0,
      holidayPay: 0,
      grossPay: 0,
      afpBase: 0,
      afpAmount: 0,
      sfsBase: 0,
      sfsAmount: 0,
      tssTotal: 0,
      taxableIncome: 0,
      isrMonthly: 0,
      isrCalculated: 0,
      isrPeriod: 0,
      customDeductionsBreakdown: [],
      customDeductions: 0,
      totalDeductions: 0,
      netPay: 0,
    }
  }

  const earnings = calculateHourlyEarnings(
    hourlyRate,
    regularHours,
    otHours,
    holidayHours,
    otRatePercent,
    holidayRatePercent,
  )

  // Pension (AFP / Social Security)
  const afpBase = roundHalfUp(Math.min(earnings.grossPay, rules.pensionCap ?? earnings.grossPay))
  const afpAmount = roundHalfUp(afpBase * (rules.pensionRate / 100))

  // Health insurance (SFS / Medicare)
  const sfsBase = roundHalfUp(Math.min(earnings.grossPay, rules.healthInsuranceCap ?? earnings.grossPay))
  const sfsAmount = roundHalfUp(sfsBase * (rules.healthInsuranceRate / 100))

  const tssTotal = roundHalfUp(afpAmount + sfsAmount)

  // Income tax — annualize gross, compute annual tax, divide by periods
  const annualGross = roundHalfUp(earnings.grossPay * rules.payPeriodsPerYear)
  const annualTax = rules.calculateIncomeTax(annualGross)
  const isrCalculated = roundHalfUp(annualTax / rules.payPeriodsPerYear)
  const isrMonthly = roundHalfUp(annualTax / 12)

  // Quincena ISR rule — only DR biweekly
  let isrRetained: number
  if (quincena === 1) {
    isrRetained = 0
  } else if (quincena === 2) {
    isrRetained = roundHalfUp(isrCalculated * 2)
  } else {
    isrRetained = isrCalculated
  }

  const customDeds = calculateCustomDeductions(earnings.grossPay, input.customDeductions)

  const totalDeductions = roundHalfUp(tssTotal + isrRetained + customDeds.total)
  const netPay = roundHalfUp(earnings.grossPay - totalDeductions)

  return {
    regularPay: earnings.regularPay,
    otPay: earnings.otPay,
    holidayPay: earnings.holidayPay,
    grossPay: earnings.grossPay,
    afpBase,
    afpAmount,
    sfsBase,
    sfsAmount,
    tssTotal,
    taxableIncome: annualGross,
    isrMonthly,
    isrCalculated,
    isrPeriod: isrRetained,
    customDeductionsBreakdown: customDeds.breakdown,
    customDeductions: customDeds.total,
    totalDeductions,
    netPay,
  }
}

/**
 * Split total hours for a week into regular and OT based on threshold.
 * Returns { regularHours, otHours }
 */
export function splitOTHours(
  totalHours: number,
  threshold: number,
): { regularHours: number; otHours: number } {
  if (totalHours <= threshold) {
    return { regularHours: totalHours, otHours: 0 }
  }
  return { regularHours: threshold, otHours: roundHalfUp(totalHours - threshold) }
}
