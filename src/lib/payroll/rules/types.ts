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
  calculateIncomeTax: (annualGross: number) => number
  incomeTaxName: string
  payPeriodsPerYear: number
  otThresholdHours: number
  holidays: string[]                  // YYYY-MM-DD dates for current+next year
  dailyDivisor: number
}
