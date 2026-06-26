import type { CountryFiscalConfig } from '@/shared/types'
import { calculateAnnualISR } from '@/modules/nomina/lib/payroll/calculations'
import { getHolidaysInRange } from '@/modules/nomina/lib/holidays'
import type { PayrollRules } from './types'

/**
 * Build engine PayrollRules from an editable per-country fiscal config (every country except
 * the Dominican Republic, which keeps its dedicated Fiscal Parameters path). Only ENABLED
 * deductions are passed to the engine; income tax uses the same annual-bracket scale as DR.
 */
export function buildRulesFromConfig(
  config: CountryFiscalConfig,
  frequency: 'biweekly' | 'weekly' | 'full_month',
  otThresholdHours: number,
): PayrollRules {
  const payPeriodsPerYear = frequency === 'full_month' ? 12 : frequency === 'weekly' ? 52 : 24

  const deductions = config.deductions
    .filter((d) => d.enabled)
    .map((d) => ({ id: d.id, name: d.name, rate: d.rate, capBase: d.capBase, fixedAmount: d.fixedAmount }))

  // Legacy pension/health slots, for any consumer still reading them (kept in sync via ids).
  const pension = deductions.find((d) => d.id === 'afp')
  const health = deductions.find((d) => d.id === 'sfs')

  const currentYear = new Date().getFullYear()
  const holidays = getHolidaysInRange(
    config.country,
    `${currentYear}-01-01`,
    `${currentYear + 1}-12-31`,
  ).map((h) => h.date)

  return {
    country: config.country,
    currency: config.currency,
    currencySymbol: config.currencySymbol,
    healthInsuranceRate: health?.rate ?? 0,
    pensionRate: pension?.rate ?? 0,
    healthInsuranceName: health?.name ?? 'Health Insurance',
    pensionName: pension?.name ?? 'Pension',
    healthInsuranceCap: health?.capBase ?? null,
    pensionCap: pension?.capBase ?? null,
    deductions,
    calculateIncomeTax: (annualTaxable: number) => calculateAnnualISR(annualTaxable, config.incomeTaxBrackets),
    incomeTaxName: config.incomeTaxName,
    payPeriodsPerYear,
    otThresholdHours,
    holidays,
    dailyDivisor: config.dailyDivisor,
  }
}
