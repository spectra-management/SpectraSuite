import type { FiscalParameters, PayrollSettings } from '@/shared/types'
import { calculateAnnualISR, roundHalfUp } from '@/modules/nomina/lib/payroll/calculations'
import { getHolidaysInRange } from '@/modules/nomina/lib/holidays'
import type { PayrollRules } from './types'

export function getDOPayrollRules(
  fiscal: FiscalParameters,
  payroll: PayrollSettings,
  frequency: 'biweekly' | 'weekly' | 'full_month',
): PayrollRules {
  const payPeriodsPerYear = frequency === 'full_month' ? 12 : frequency === 'biweekly' ? 24 : 52

  // DR holidays for current + next year, from the hybrid store (Nager.Date + manual),
  // falling back to the computed statutory set before the first sync.
  const currentYear = new Date().getFullYear()
  const holidays = getHolidaysInRange(
    'Dominican Republic',
    `${currentYear}-01-01`,
    `${currentYear + 1}-12-31`,
  ).map((h) => h.date)

  const sfsCap = roundHalfUp(fiscal.minCotizableSalary * fiscal.sfsCapMultiplier)
  const afpCap = roundHalfUp(fiscal.minCotizableSalary * fiscal.afpCapMultiplier)

  return {
    country: 'Dominican Republic',
    currency: 'DOP',
    currencySymbol: 'RD$',
    healthInsuranceRate: fiscal.sfsRate,
    pensionRate: fiscal.afpRate,
    healthInsuranceName: 'Family Health Insurance (SFS)',
    pensionName: 'Pension Retention (AFP)',
    healthInsuranceCap: sfsCap,
    pensionCap: afpCap,
    // DR's two TSS contributions as the generic deduction list (ids drive the legacy
    // afp/sfs result fields + the existing paystub rows). Order: SFS then AFP.
    deductions: [
      { id: 'sfs', name: 'SFS', rate: fiscal.sfsRate, capBase: sfsCap },
      { id: 'afp', name: 'AFP', rate: fiscal.afpRate, capBase: afpCap },
    ],
    // DGII annual scale. The DR monthly-ISR aggregation (1st quincena deferred; 2nd
    // quincena base = net 1st fortnight + net 2nd fortnight, ×12) lives in
    // calculatePayroll, which has the per-employee TSS + period context this scale needs.
    calculateIncomeTax: (annualTaxable: number) => calculateAnnualISR(annualTaxable, fiscal.isrBrackets),
    incomeTaxName: 'Tax Retention ISR (DGII)',
    payPeriodsPerYear,
    otThresholdHours: payroll.otThresholdHours,
    holidays,
    dailyDivisor: fiscal.dailyDivisor,
  }
}
