import type { PayrollRules } from './types'
import { getDefaultPayrollRules } from './default'

/**
 * Kenya payroll rules — PLACEHOLDER.
 *
 * Statutory deductions (PAYE income tax, NSSF, SHIF/NHIF, housing levy) are not yet
 * implemented, so this currently mirrors the generic ruleset: 0% income tax,
 * 0% pension/health, gross pay only. Replace `calculateIncomeTax` and the `*Rate`
 * fields when the real Kenyan rules are added.
 */
export function getKEPayrollRules(
  country: string,
  frequency: 'biweekly' | 'weekly' | 'full_month',
): PayrollRules {
  return { ...getDefaultPayrollRules(country, frequency), incomeTaxName: 'PAYE' }
}
