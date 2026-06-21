import type { PayrollRules } from './types'
import { getDefaultPayrollRules } from './default'

/**
 * Philippines payroll rules — PLACEHOLDER.
 *
 * Statutory deductions (BIR withholding tax, SSS, PhilHealth, Pag-IBIG) are not yet
 * implemented, so this currently mirrors the generic ruleset: 0% income tax,
 * 0% pension/health, gross pay only. Replace `calculateIncomeTax` and the `*Rate`
 * fields when the real Philippine rules are added.
 */
export function getPHPayrollRules(
  country: string,
  frequency: 'biweekly' | 'weekly' | 'full_month',
): PayrollRules {
  return { ...getDefaultPayrollRules(country, frequency), incomeTaxName: 'Withholding Tax' }
}
