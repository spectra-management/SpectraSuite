import type { FiscalParameters, PayrollSettings, CountryFiscalConfig } from '@/shared/types'
import { getDOPayrollRules } from './do'
import { getDefaultPayrollRules } from './default'
import { buildRulesFromConfig } from './fromConfig'
import { COUNTRY_FISCAL_DEFAULTS, countryKey } from '@/shared/lib/countryFiscalDefaults'
import type { PayrollRules } from './types'

export type { PayrollRules }
export { getCurrencySymbol } from './currency'

function isDR(country: string): boolean {
  const c = country.toLowerCase().trim()
  return c.includes('dominican') || c === 'do' || c === 'unknown' || c === ''
}

export function isKnownCountry(country: string): boolean {
  if (isDR(country)) return true
  return !!COUNTRY_FISCAL_DEFAULTS[countryKey(country)]
}

/**
 * Build the payroll rules for a country.
 *
 * - Dominican Republic keeps its dedicated path (Fiscal Parameters + quincena ISR).
 * - Every other country is driven by its editable CountryFiscalConfig: the caller passes the
 *   user's merged configs (defaults + edits) via `countryConfigs`; when absent (or the country
 *   has none) we fall back to the researched defaults, then to a zero-deduction generic.
 */
export function getPayrollRules(
  country: string,
  frequency: 'biweekly' | 'weekly' | 'full_month',
  fiscal: FiscalParameters,
  payroll: PayrollSettings,
  countryConfigs?: Record<string, CountryFiscalConfig>,
): PayrollRules {
  if (isDR(country)) {
    return getDOPayrollRules(fiscal, payroll, frequency)
  }
  const key = countryKey(country)
  const config = countryConfigs?.[key] ?? COUNTRY_FISCAL_DEFAULTS[key]
  if (config) {
    return buildRulesFromConfig(config, frequency, payroll.otThresholdHours)
  }
  // Any other country: generic rules — no statutory deductions, gross pay only.
  return getDefaultPayrollRules(country, frequency)
}
