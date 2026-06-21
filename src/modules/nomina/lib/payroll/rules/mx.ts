import type { PayrollRules } from './types'
import { getDefaultPayrollRules } from './default'

/**
 * Mexico payroll rules — PLACEHOLDER.
 *
 * Statutory deductions (ISR, IMSS) are not yet implemented, so this currently
 * mirrors the generic ruleset: 0% income tax, 0% pension/health, gross pay only.
 * When the real Mexican tax tables are added, replace `calculateIncomeTax` and the
 * `*Rate` fields here — the selector in `index.ts` already routes Mexico to this file.
 */
export function getMXPayrollRules(
  country: string,
  frequency: 'biweekly' | 'weekly' | 'full_month',
): PayrollRules {
  return { ...getDefaultPayrollRules(country, frequency), incomeTaxName: 'ISR' }
}
