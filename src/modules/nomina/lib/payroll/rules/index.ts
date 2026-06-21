import type { FiscalParameters, PayrollSettings } from '@/shared/types'
import { getDOPayrollRules } from './do'
import { getUSPayrollRules } from './us'
import { getMXPayrollRules } from './mx'
import { getJMPayrollRules } from './jm'
import { getPHPayrollRules } from './ph'
import { getKEPayrollRules } from './ke'
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
    c.includes('mexic') || c.includes('méxic') || c === 'mx' ||
    c.includes('jamaica') || c === 'jm' ||
    c.includes('philippine') || c.includes('filipin') || c === 'ph' ||
    c.includes('kenya') || c === 'ke' ||
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
  if (c.includes('mexic') || c.includes('méxic') || c === 'mx') {
    return getMXPayrollRules(country, frequency)
  }
  if (c.includes('jamaica') || c === 'jm') {
    return getJMPayrollRules(country, frequency)
  }
  if (c.includes('philippine') || c.includes('filipin') || c === 'ph') {
    return getPHPayrollRules(country, frequency)
  }
  if (c.includes('kenya') || c === 'ke') {
    return getKEPayrollRules(country, frequency)
  }
  // Any other country: generic rules — no statutory deductions, gross pay only
  return getDefaultPayrollRules(country, frequency)
}
