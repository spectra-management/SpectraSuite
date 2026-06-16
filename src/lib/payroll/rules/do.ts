import type { FiscalParameters, PayrollSettings } from '@/types'
import { calculateAnnualISR, roundHalfUp } from '@/lib/payroll/calculations'
import { getDRHolidaysInRange } from '@/lib/drHolidays'
import type { PayrollRules } from './types'

export function getDOPayrollRules(
  fiscal: FiscalParameters,
  payroll: PayrollSettings,
  frequency: 'biweekly' | 'weekly',
): PayrollRules {
  const payPeriodsPerYear = frequency === 'biweekly' ? 24 : 52

  // Compute DR holidays for current year + next year
  const currentYear = new Date().getFullYear()
  const holidayObjects = getDRHolidaysInRange(
    `${currentYear}-01-01`,
    `${currentYear + 1}-12-31`,
  )
  const holidays = holidayObjects.map((h) => h.date)

  return {
    country: 'Dominican Republic',
    currency: 'DOP',
    currencySymbol: 'RD$',
    healthInsuranceRate: fiscal.sfsRate,
    pensionRate: fiscal.afpRate,
    healthInsuranceName: 'Family Health Insurance (SFS)',
    pensionName: 'Pension Retention (AFP)',
    healthInsuranceCap: roundHalfUp(fiscal.minCotizableSalary * fiscal.sfsCapMultiplier),
    pensionCap: roundHalfUp(fiscal.minCotizableSalary * fiscal.afpCapMultiplier),
    calculateIncomeTax: (annualGross: number) => calculateAnnualISR(annualGross, fiscal.isrBrackets),
    incomeTaxName: 'Tax Retention ISR (DGII)',
    payPeriodsPerYear,
    otThresholdHours: payroll.otThresholdHours,
    holidays,
    dailyDivisor: fiscal.dailyDivisor,
  }
}
