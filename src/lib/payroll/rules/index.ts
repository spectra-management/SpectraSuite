import type { FiscalParameters, PayrollSettings } from '@/types'
import { getDOPayrollRules } from './do'
import { getUSPayrollRules } from './us'
import { getDefaultPayrollRules } from './default'
import type { PayrollRules } from './types'

export type { PayrollRules }
export { getCurrencySymbol } from './currency'

export function isKnownCountry(country: string): boolean {
  const c = country.toLowerCase().trim()
  return (
    c.includes('dominican') ||
    c === 'do' ||
    c.includes('united states') ||
    c === 'us' ||
    c === 'unknown' ||
    c === ''
  )
}

export function getPayrollRules(
  country: string,
  frequency: 'biweekly' | 'weekly' | 'full_month',
  fiscal: FiscalParameters,
  payroll: PayrollSettings,
): PayrollRules {
  const c = country.toLowerCase().trim()
  if (c.includes('united states') || c === 'us') {
    return getUSPayrollRules(frequency)
  }
  if (c.includes('dominican') || c === 'do' || c === 'unknown' || c === '') {
    return getDOPayrollRules(fiscal, payroll, frequency)
  }
  // Any other country: generic rules — no statutory deductions, gross pay only
  return getDefaultPayrollRules(country, frequency)
}
