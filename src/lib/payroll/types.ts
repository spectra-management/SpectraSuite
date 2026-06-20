import type { PayrollRules } from './rules/types'
import type { CustomDeduction, NightShiftSettings } from '@/types'

export interface CalculationInput {
  employeeId: string
  // 'Hourly' (default): hourlyRate × hours. 'Salary': fixed pay; hourlyRate carries the MONTHLY salary.
  payType?: 'Hourly' | 'Salary'
  hourlyRate: number
  regularHours: number
  otHours: number
  holidayHours: number
  customDeductions: CustomDeduction[]
  rules: PayrollRules
  frequency: 'biweekly' | 'weekly' | 'full_month'
  // OT and holiday rate — passed from PayrollSettings
  otRatePercent?: number       // default 35
  holidayRatePercent?: number  // default 100
  // Period start date (YYYY-MM-DD). Used to auto-detect DR biweekly quincena rule:
  //   day 1-15  → 1st quincena: ISR deferred (retained = 0)
  //   day 16-31 → 2nd quincena: ISR retained = full month's ISR
  periodStart?: string
  // Period end date (YYYY-MM-DD). When periodStart is day 1 and periodEnd is the last
  // day of the same month, the DR engine treats the run as a FULL MONTH: salaried pay
  // is the full monthly salary and the whole month's ISR is retained (not deferred).
  periodEnd?: string
  // Gross pay of the SAME employee's 1st fortnight (same month/country). Required for the
  // DR 2nd-quincena ISR: monthly base = net(1st fortnight) + net(2nd fortnight). When absent
  // the engine falls back to assuming both fortnights are equal.
  firstFortnightGross?: number
  // Manually-entered nocturnal hours for the period (Hourly employees only).
  nightHours?: number
  // Night-shift config (mixed-shift threshold). When absent, no night incentive is applied.
  nightShift?: NightShiftSettings
  // Pending vacation ISR to collect this period. Only applied on the DR 2nd fortnight.
  pendingVacationIsr?: number
}

export interface CalculationResult {
  regularPay: number
  otPay: number
  holidayPay: number
  grossPay: number
  afpBase: number
  afpAmount: number
  sfsBase: number
  sfsAmount: number
  tssTotal: number
  taxableIncome: number
  // Monthly net base the ISR scale is applied to. DR biweekly 2nd quincena: net(1st)+net(2nd).
  // 1st quincena: 0 (deferred). Other countries/weekly: this period's gross (display continuity).
  isrMonthlyBase: number
  // Full month's ISR (annual ISR ÷ 12).
  isrMonthly: number
  // ISR computed for the period (= isrMonthly for DR; = isrPeriod for others). Kept for compatibility.
  isrCalculated: number
  // ISR actually retained this period: 0 on DR 1st quincena, full month's ISR on 2nd, per-period otherwise
  isrPeriod: number
  // True only on the DR 1st quincena, where ISR is deferred to the 2nd fortnight.
  isrDeferred: boolean
  // Nocturnal 15% incentive (additive to gross). hours the incentive applies to + the amount.
  nightIncentiveHours: number
  nightIncentiveAmount: number
  // Pending vacation ISR collected this period (DR 2nd fortnight only). Included in totalDeductions.
  vacationIsr: number
  customDeductionsBreakdown: Array<{ name: string; amount: number }>
  customDeductions: number
  totalDeductions: number
  netPay: number
}
