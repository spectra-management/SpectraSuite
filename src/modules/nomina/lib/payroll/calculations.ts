import type { ISRBracket, PayrollPeriod } from '@/shared/types'
import { roundHalfUp, safeNum } from '@/shared/lib/number'
import type { CalculationInput, CalculationResult } from './types'

// Re-exported so existing payroll consumers can keep importing these from here.
export { roundHalfUp, safeNum }

/**
 * Format a monetary value as RD$ 1,234.56
 */
export function formatCurrency(value: number): string {
  const rounded = roundHalfUp(safeNum(value), 2)
  return `RD$ ${rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Format a monetary value with a given currency symbol, e.g. MX$ 1,234.56
 */
export function formatCurrencyWithSymbol(value: number, symbol: string): string {
  const rounded = roundHalfUp(safeNum(value), 2)
  return `${symbol} ${rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Calculate hourly earnings (regular, OT, holiday).
 *
 * ALL worked hours (regular + OT + holiday) are first paid at 100% of the rate in regular pay.
 * OT and holiday hours then earn an ADDITIONAL premium on top (the differential only):
 *
 *   regularPay  = rate × (regularHours + otHours + holidayHours)        // every hour at 100%
 *   otPay       = rate × otHours × (otRatePercent / 100)                // OT differential (e.g. +50%)
 *   holidayPay  = rate × holidayHours × (holidayRatePercent / 100)      // holiday differential (e.g. +100%)
 *
 * So OT hours total otRatePercent over base (100% + 50% = 150%) and holiday hours total
 * holidayRatePercent over base (100% + 100% = 200%), each counted once in regular + once as
 * the premium. (regularHours, otHours and holidayHours are stored as disjoint buckets.)
 */
function calculateHourlyEarnings(
  hourlyRate: number,
  regularHours: number,
  otHours: number,
  holidayHours: number,
  otRatePercent: number,
  holidayRatePercent: number,
): { regularPay: number; otPay: number; holidayPay: number; grossPay: number } {
  // Every worked hour (regular + OT + holiday) is paid at 100% as regular pay.
  const regularPay = roundHalfUp(hourlyRate * (regularHours + otHours + holidayHours))
  // OT pay is the ADDITIONAL premium only (e.g. +50%), on top of regular pay.
  const otPay = roundHalfUp(hourlyRate * otHours * (otRatePercent / 100))
  // Holiday pay is the ADDITIONAL premium only (e.g. +100%), on top of regular pay.
  const holidayPay = roundHalfUp(hourlyRate * holidayHours * (holidayRatePercent / 100))
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
 * Finds the gross pay of an employee's 1st fortnight (same month + country) from
 * saved payroll history. Used to build the DR 2nd-quincena monthly ISR base.
 * Returns undefined when no matching 1st-quincena run is saved.
 */
export function findFirstFortnightGross(
  history: PayrollPeriod[],
  country: string,
  secondFortnightStart: string,
  employeeId: string,
): number | undefined {
  const d = new Date(secondFortnightStart + 'T00:00:00')
  const year = d.getFullYear()
  const month = d.getMonth()
  const targetCountry = (country || '').toLowerCase().trim()

  // Most recent matching 1st-quincena period in the same month + country
  const matches = history.filter((p) => {
    if (p.frequency !== 'biweekly') return false
    const ps = new Date(p.startDate + 'T00:00:00')
    if (ps.getFullYear() !== year || ps.getMonth() !== month) return false
    if (ps.getDate() > 15) return false // must be the 1st quincena (day 1-15)
    const pc = (p.country || '').toLowerCase().trim()
    if (targetCountry && pc && pc !== targetCountry) return false
    return true
  })
  if (matches.length === 0) return undefined

  const period = matches[matches.length - 1]
  const entry = period.entries.find((e) => e.employee.id === employeeId)
  return entry?.calculation.grossPay
}

/**
 * Standard scheduled work hours in a pay period: workdays (Mon–Fri) in the
 * inclusive [startDate, endDate] range × 8h. Used to auto-populate hours for
 * Salary employees (who don't track hours in Hubstaff).
 */
export function standardPeriodHours(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0
  const d = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (isNaN(d.getTime()) || isNaN(end.getTime()) || d > end) return 0
  let workdays = 0
  while (d <= end) {
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) workdays++
    d.setDate(d.getDate() + 1)
  }
  return workdays * 8
}

/**
 * Main payroll calculation function.
 * Pure function — no side effects, no UI dependencies.
 *
 * Salary employees (input.payType === 'Salary'): pay is fixed regardless of hours.
 *   input.hourlyRate carries the MONTHLY salary; period gross = monthlySalary × 12 / payPeriodsPerYear
 *   (e.g. monthly/2 biweekly). AFP/SFS/ISR are then computed on that gross like any other.
 *
 * DR biweekly ISR rule (only when rules.country includes 'dominican'):
 *   ISR is computed on income AFTER TSS (AFP + SFS), on a MONTHLY basis.
 *   1st quincena (startDay 1-15): ISR deferred — retain 0.
 *   2nd quincena (startDay 16-31): monthly base = net(1st fortnight) + net(2nd fortnight),
 *     annualized ×12, DGII scale applied, ÷12 → the full month's ISR is retained here.
 *     The 1st fortnight's gross is taken from input.firstFortnightGross (falls back to the
 *     current fortnight when absent, i.e. assumes equal fortnights).
 *   US and other countries / weekly / no periodStart: ISR retained every period (gross-annualized).
 */
export function calculatePayroll(input: CalculationInput): CalculationResult {
  const {
    rules,
    frequency,
    otRatePercent = 50,
    holidayRatePercent = 100,
  } = input

  // Coerce every numeric input — a NaN/undefined value (e.g. a Salary employee with no
  // tracked hours, or an unset rate) must never propagate into the result or the PDF.
  const isSalary = input.payType === 'Salary'
  const baseRate = safeNum(input.hourlyRate)        // hourly rate, or MONTHLY salary when isSalary
  const regularHours = safeNum(input.regularHours)
  const otHours = safeNum(input.otHours)
  const holidayHours = safeNum(input.holidayHours)

  // Full-month frequency: the whole month is one run. DR computes the month's ISR on
  // the net-of-TSS base (the dedicated branch below); other countries fall through to
  // the generic per-period branch, which with payPeriodsPerYear = 12 annualizes ×12.
  // The DR biweekly quincena rule only applies to the biweekly frequency.
  const isDR = rules.country.toLowerCase().includes('dominican')
  const isFullMonth = isDR && frequency === 'full_month'
  let quincena: 1 | 2 | null = null
  if (isDR && frequency === 'biweekly' && input.periodStart) {
    const day = new Date(input.periodStart + 'T00:00:00').getDate()
    quincena = day <= 15 ? 1 : 2
  }

  // Hourly needs hours to earn; Salary is paid regardless of hours.
  if (baseRate <= 0 || (!isSalary && (regularHours + otHours + holidayHours) === 0)) {
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
      deductionsBreakdown: [],
      taxableIncome: 0,
      isrMonthlyBase: 0,
      isrMonthly: 0,
      isrCalculated: 0,
      isrPeriod: 0,
      isrDeferred: false,
      nightIncentiveHours: 0,
      nightIncentiveAmount: 0,
      vacationIsr: 0,
      customDeductionsBreakdown: [],
      customDeductions: 0,
      totalDeductions: 0,
      netPay: 0,
    }
  }

  const earnings = isSalary
    // Salary: fixed pay per period = monthly salary × 12 / pay periods per year (e.g. monthly/2
    // biweekly). A full-month run pays the WHOLE monthly salary.
    ? (() => {
        const periodGross = isFullMonth
          ? roundHalfUp(baseRate)
          : roundHalfUp((baseRate * 12) / rules.payPeriodsPerYear)
        return { regularPay: periodGross, otPay: 0, holidayPay: 0, grossPay: periodGross }
      })()
    : calculateHourlyEarnings(
        baseRate,
        regularHours,
        otHours,
        holidayHours,
        otRatePercent,
        holidayRatePercent,
      )

  // ── Night-shift 15% incentive (DR recargo nocturno) ────────────────────────
  // Hourly only (rate is per-hour). The mixed-shift threshold from settings decides
  // whether the 15% applies to ALL the period's worked hours or just the night portion.
  // Additive to gross (and therefore subject to TSS + ISR).
  const nightHoursInput = safeNum(input.nightHours)
  let nightIncentiveHours = 0
  let nightIncentiveAmount = 0
  if (!isSalary && nightHoursInput > 0 && input.nightShift) {
    const worked = regularHours + otHours + holidayHours
    const night = worked > 0 ? Math.min(nightHoursInput, worked) : nightHoursInput
    const fullyNocturnal = input.nightShift.mixedThresholdMode === 'hours'
      ? night > safeNum(input.nightShift.mixedThresholdHours)
      : (worked > 0 && night / worked > 0.5)
    nightIncentiveHours = roundHalfUp(fullyNocturnal ? worked : night, 2)
    nightIncentiveAmount = roundHalfUp(nightIncentiveHours * baseRate * 0.15, 2)
  }

  // Period gross including the nocturnal incentive.
  const grossPay = roundHalfUp(earnings.grossPay + nightIncentiveAmount)

  // DR "salario cotizable": the overtime and holiday PREMIUMS are non-cotizable extra
  // pay, so AFP/SFS and the ISR base are computed on income EXCLUDING both bonuses
  // (worked OT/holiday hours are already paid at 100% inside regular pay, which IS
  // cotizable — only the 35%/100% surcharges are excluded). Other countries use the
  // full gross.
  const contributoryBase = isDR
    ? roundHalfUp(grossPay - earnings.holidayPay - earnings.otPay)
    : grossPay

  // Tax-exempt employee: all statutory deductions and ISR are waived (custom deductions
  // still apply).
  const taxExempt = !!input.taxExempt

  // ── Statutory deductions (per-country, flexible list) ────────────────────────
  // Each deduction is a flat amount or a percentage of the (optionally capped) base.
  // The DR holiday bonus is non-cotizable, so it's already excluded from contributoryBase.
  const deductionsBreakdown = rules.deductions.map((d) => {
    const base = roundHalfUp(Math.min(contributoryBase, d.capBase ?? contributoryBase))
    const amount = taxExempt
      ? 0
      : d.fixedAmount != null
        ? roundHalfUp(d.fixedAmount)
        : roundHalfUp(base * (d.rate / 100))
    // rate shown on the paystub; 0 for flat-amount deductions.
    return { id: d.id, name: d.name, rate: d.fixedAmount != null ? 0 : d.rate, base, amount }
  })
  const tssTotal = roundHalfUp(deductionsBreakdown.reduce((s, x) => s + x.amount, 0))

  // Legacy pension/health result fields, kept for back-compat (DR/US set ids afp/sfs).
  const afpEntry = deductionsBreakdown.find((x) => x.id === 'afp')
  const sfsEntry = deductionsBreakdown.find((x) => x.id === 'sfs')
  const afpBase = afpEntry?.base ?? 0
  const afpAmount = afpEntry?.amount ?? 0
  const sfsBase = sfsEntry?.base ?? 0
  const sfsAmount = sfsEntry?.amount ?? 0

  // ── Income tax (ISR) ───────────────────────────────────────────────────────
  // This fortnight's cotizable income net of all statutory deductions (ISR is applied
  // AFTER them, on the same base that excludes the non-cotizable holiday bonus).
  const netThisPeriod = roundHalfUp(contributoryBase - tssTotal)

  // Statutory deductions for an arbitrary gross (same caps) — used to derive the 1st
  // fortnight's net from its gross (DR 2nd-quincena ISR aggregation).
  const tssForGross = (gross: number): number =>
    roundHalfUp(rules.deductions.reduce((s, d) => {
      if (d.fixedAmount != null) return s + d.fixedAmount
      const base = Math.min(gross, d.capBase ?? gross)
      return s + roundHalfUp(base * (d.rate / 100))
    }, 0))

  let isrMonthlyBase: number  // monthly net base the DGII scale is applied to
  let isrMonthly: number      // full month's ISR (annual ÷ 12)
  let isrRetained: number     // ISR actually withheld this period
  let annualTaxable: number   // annualized taxable base (for reference/display)

  if (isFullMonth) {
    // DR full month: this single run already covers the whole month, so the monthly
    // ISR base is this period's net; annualize ×12 and retain the full month's ISR.
    isrMonthlyBase = netThisPeriod
    annualTaxable = roundHalfUp(isrMonthlyBase * 12)
    const annualTax = rules.calculateIncomeTax(annualTaxable)
    isrMonthly = roundHalfUp(annualTax / 12)
    isrRetained = isrMonthly
  } else if (quincena === 1) {
    // DR 1st quincena: defer ISR to the 2nd fortnight
    isrMonthlyBase = 0
    annualTaxable = 0
    isrMonthly = 0
    isrRetained = 0
  } else if (quincena === 2) {
    // DR 2nd quincena: monthly base = net(1st fortnight) + net(2nd fortnight)
    const firstGross = input.firstFortnightGross ?? grossPay
    const firstNet = roundHalfUp(firstGross - tssForGross(firstGross))
    isrMonthlyBase = roundHalfUp(firstNet + netThisPeriod)
    annualTaxable = roundHalfUp(isrMonthlyBase * 12)
    const annualTax = rules.calculateIncomeTax(annualTaxable)
    isrMonthly = roundHalfUp(annualTax / 12)
    isrRetained = isrMonthly
  } else {
    // US / other countries / weekly / no periodStart: per-period ISR, gross-annualized
    annualTaxable = roundHalfUp(grossPay * rules.payPeriodsPerYear)
    const annualTax = rules.calculateIncomeTax(annualTaxable)
    isrRetained = roundHalfUp(annualTax / rules.payPeriodsPerYear)
    isrMonthly = roundHalfUp(annualTax / 12)
    isrMonthlyBase = grossPay
  }

  // Tax-exempt: waive ALL income tax (this period and the monthly figures shown).
  if (taxExempt) {
    isrMonthlyBase = 0
    annualTaxable = 0
    isrMonthly = 0
    isrRetained = 0
  }

  // isrCalculated kept for compatibility: monthly ISR on DR quincena/full-month runs, per-period otherwise
  const isrCalculated = quincena !== null || isFullMonth ? isrMonthly : isrRetained
  const isrDeferred = !taxExempt && quincena === 1

  const customDeds = calculateCustomDeductions(grossPay, input.customDeductions)

  // Pending vacation ISR is collected where the month's ISR is retained: the DR 2nd
  // fortnight, or a full-month run — never for a tax-exempt employee.
  const vacationIsr = !taxExempt && (quincena === 2 || isFullMonth)
    ? roundHalfUp(safeNum(input.pendingVacationIsr))
    : 0

  const totalDeductions = roundHalfUp(tssTotal + isrRetained + vacationIsr + customDeds.total)
  const netPay = roundHalfUp(grossPay - totalDeductions)

  return {
    regularPay: earnings.regularPay,
    otPay: earnings.otPay,
    holidayPay: earnings.holidayPay,
    grossPay: grossPay,
    afpBase,
    afpAmount,
    sfsBase,
    sfsAmount,
    tssTotal,
    deductionsBreakdown,
    taxableIncome: annualTaxable,
    isrMonthlyBase,
    isrMonthly,
    isrCalculated,
    isrPeriod: isrRetained,
    isrDeferred,
    nightIncentiveHours,
    nightIncentiveAmount,
    vacationIsr,
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
