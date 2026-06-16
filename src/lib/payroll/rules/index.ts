import type { FiscalParameters, PayrollSettings } from '@/types'
import { getDOPayrollRules } from './do'
import { getUSPayrollRules } from './us'
import type { PayrollRules } from './types'

export type { PayrollRules }

export function getPayrollRules(
  country: string,
  frequency: 'biweekly' | 'weekly',
  fiscal: FiscalParameters,
  payroll: PayrollSettings,
): PayrollRules {
  const c = country.toLowerCase()
  if (c.includes('united states') || c === 'us') {
    return getUSPayrollRules(frequency)
  }
  // Dominican Republic, Unknown, empty string, or anything else → DR rules
  return getDOPayrollRules(fiscal, payroll, frequency)
}
