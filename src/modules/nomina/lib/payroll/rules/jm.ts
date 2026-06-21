import type { PayrollRules } from './types'
import { getDefaultPayrollRules } from './default'

/**
 * Jamaica payroll rules — PLACEHOLDER.
 *
 * Statutory deductions (PAYE income tax, NIS, NHT, education tax) are not yet
 * implemented, so this currently mirrors the generic ruleset: 0% income tax,
 * 0% pension/health, gross pay only. Replace `calculateIncomeTax` and the `*Rate`
 * fields when the real Jamaican rules are added.
 */
export function getJMPayrollRules(
  country: string,
  frequency: 'biweekly' | 'weekly' | 'full_month',
): PayrollRules {
  return { ...getDefaultPayrollRules(country, frequency), incomeTaxName: 'PAYE' }
}
