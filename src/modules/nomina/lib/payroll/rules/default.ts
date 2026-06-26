import type { PayrollRules } from './types'
import { getCurrencySymbol } from './currency'

export function getDefaultPayrollRules(
  country: string,
  frequency: 'biweekly' | 'weekly' | 'full_month',
): PayrollRules {
  const payPeriodsPerYear = frequency === 'full_month' ? 12 : frequency === 'weekly' ? 52 : 24
  return {
    country,
    currency: 'USD',
    currencySymbol: getCurrencySymbol(country),
    healthInsuranceRate: 0,
    pensionRate: 0,
    healthInsuranceName: 'Health Insurance',
    pensionName: 'Pension',
    healthInsuranceCap: null,
    pensionCap: null,
    deductions: [],
    calculateIncomeTax: () => 0,
    incomeTaxName: 'Income Tax',
    payPeriodsPerYear,
    otThresholdHours: 40,
    holidays: [],
    dailyDivisor: 23.83,
  }
}
