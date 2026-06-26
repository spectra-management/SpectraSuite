import { COUNTRY_FISCAL_DEFAULTS } from '@/modules/nomina/lib/payroll/countryFiscalDefaults'
import { buildRulesFromConfig } from './fromConfig'
import type { PayrollRules } from './types'

/**
 * US payroll rules — now built from the editable per-country fiscal config (Social Security,
 * Medicare, 2025 federal brackets). Kept as a named helper for the engine tests + any direct
 * callers; the live app routes through getPayrollRules with the user's (possibly edited) config.
 */
export function getUSPayrollRules(frequency: 'biweekly' | 'weekly' | 'full_month'): PayrollRules {
  return buildRulesFromConfig(COUNTRY_FISCAL_DEFAULTS['united states'], frequency, 40)
}
