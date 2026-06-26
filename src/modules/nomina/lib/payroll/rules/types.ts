/** A statutory deduction the engine applies (already filtered to enabled ones). */
export interface PayrollRuleDeduction {
  id: string
  name: string
  rate: number              // percent of the (optionally capped) base
  capBase: number | null    // per-period base ceiling; null = no cap
  fixedAmount?: number      // flat per-period amount instead of rate × base
}

export interface PayrollRules {
  country: string
  currency: string
  currencySymbol: string
  healthInsuranceRate: number
  pensionRate: number
  healthInsuranceName: string
  pensionName: string
  healthInsuranceCap: number | null   // per-period cap (null = no cap)
  pensionCap: number | null           // per-period cap (null = no cap)
  /** Flexible per-country statutory deductions (the engine sums these). 'afp'/'sfs' ids
   *  populate the legacy pension/health result fields for back-compat. */
  deductions: PayrollRuleDeduction[]
  calculateIncomeTax: (annualGross: number) => number
  incomeTaxName: string
  payPeriodsPerYear: number
  otThresholdHours: number
  holidays: string[]                  // YYYY-MM-DD dates for current+next year
  dailyDivisor: number
}
