import type { FiscalParameters, PayrollSettings } from '@/types'

export const DEFAULT_FISCAL_PARAMETERS: FiscalParameters = {
  minCotizableSalary: 16341.60,
  afpRate: 2.87,
  sfsRate: 3.04,
  afpCapMultiplier: 20,
  sfsCapMultiplier: 10,
  dailyDivisor: 23.83,
  isrBrackets: [
    { minAmount: 0, maxAmount: 416220.00, rate: 0, fixedAmount: 0 },
    { minAmount: 416220.01, maxAmount: 624329.00, rate: 15, fixedAmount: 0 },
    { minAmount: 624329.01, maxAmount: 867123.00, rate: 20, fixedAmount: 31216.00 },
    { minAmount: 867123.01, maxAmount: null, rate: 25, fixedAmount: 79776.00 },
  ],
}

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  frequency: 'biweekly',
  otThresholdHours: 40,
  otRatePercent: 35,
  holidayRatePercent: 100,
}
