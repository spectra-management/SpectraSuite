import type { PayrollRules } from './rules/types'
import type { CustomDeduction } from '@/types'

export interface CalculationInput {
  employeeId: string
  hourlyRate: number
  regularHours: number
  otHours: number
  holidayHours: number
  customDeductions: CustomDeduction[]
  rules: PayrollRules
  frequency: 'biweekly' | 'weekly'
  // OT and holiday rate — passed from PayrollSettings
  otRatePercent?: number       // default 35
  holidayRatePercent?: number  // default 100
  // Period start date (YYYY-MM-DD). Used to auto-detect DR biweekly quincena rule:
  //   day 1-15  → 1st quincena: ISR calculated but retained = 0
  //   day 16-31 → 2nd quincena: ISR retained = isrCalculated × 2
  periodStart?: string
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
  isrMonthly: number
  // ISR calculated for this period (gross × periodsPerYear → annual ISR ÷ periodsPerYear)
  isrCalculated: number
  // ISR actually retained this period: 0 on 1st quincena (DR), isrCalculated×2 on 2nd, normal otherwise
  isrPeriod: number
  customDeductionsBreakdown: Array<{ name: string; amount: number }>
  customDeductions: number
  totalDeductions: number
  netPay: number
}
