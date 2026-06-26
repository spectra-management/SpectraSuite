import type { CountryFiscalConfig } from '@/shared/types'

/**
 * Researched DEFAULT fiscal rules per country (employee statutory deductions + income tax).
 *
 * These are starting points — every value is editable in Nómina → Settings → Country taxes,
 * and each deduction can be toggled on/off per country. Rates/ceilings/brackets reflect
 * 2025–2026 public sources and SHOULD be verified before a live run. Notes:
 *  - `capBase` is a PER-PAY-PERIOD base ceiling; most are left null (no cap) on purpose so the
 *    math is safe across frequencies — add a ceiling where your legal cap requires one.
 *  - Income tax is applied on the period gross annualised (the engine's non-DR path); personal
 *    reliefs / standard deductions are NOT auto-applied — fold them into the brackets if needed.
 *  - The Dominican Republic is intentionally NOT here: it keeps its dedicated Fiscal Parameters
 *    (quincena ISR + legal paystub).
 *
 * Sources: PwC Worldwide Tax Summaries, SSS/PhilHealth/Pag-IBIG 2025 tables, KRA (NSSF/SHIF/
 * Housing Levy 2025), TAJ Jamaica, Board of Inland Revenue T&T, IRS/SSA 2025, SAT México.
 */

const d = (
  id: string,
  name: string,
  rate: number,
  capBase: number | null = null,
  extra: { fixedAmount?: number } = {},
): { id: string; name: string; rate: number; capBase: number | null; enabled: boolean; fixedAmount?: number } => ({
  id, name, rate, capBase, enabled: true, ...extra,
})

export const COUNTRY_FISCAL_DEFAULTS: Record<string, CountryFiscalConfig> = {
  jamaica: {
    country: 'Jamaica',
    currency: 'JMD',
    currencySymbol: 'J$',
    dailyDivisor: 23.83,
    deductions: [
      d('nis', 'NIS', 3),
      d('nht', 'NHT', 2),
      d('edutax', 'Education Tax', 2.25),
    ],
    incomeTaxName: 'PAYE',
    incomeTaxBrackets: [
      { minAmount: 0, maxAmount: 1500096, rate: 0, fixedAmount: 0 },
      { minAmount: 1500096, maxAmount: 6000000, rate: 25, fixedAmount: 0 },
      { minAmount: 6000000, maxAmount: null, rate: 30, fixedAmount: 1124976 },
    ],
  },

  philippines: {
    country: 'Philippines',
    currency: 'PHP',
    currencySymbol: '₱',
    dailyDivisor: 26,
    deductions: [
      d('sss', 'SSS', 4.5, 35000),
      d('philhealth', 'PhilHealth', 2.5, 100000),
      d('pagibig', 'Pag-IBIG', 2, 10000),
    ],
    incomeTaxName: 'Withholding Tax (BIR)',
    incomeTaxBrackets: [
      { minAmount: 0, maxAmount: 250000, rate: 0, fixedAmount: 0 },
      { minAmount: 250000, maxAmount: 400000, rate: 15, fixedAmount: 0 },
      { minAmount: 400000, maxAmount: 800000, rate: 20, fixedAmount: 22500 },
      { minAmount: 800000, maxAmount: 2000000, rate: 25, fixedAmount: 102500 },
      { minAmount: 2000000, maxAmount: 8000000, rate: 30, fixedAmount: 402500 },
      { minAmount: 8000000, maxAmount: null, rate: 35, fixedAmount: 2202500 },
    ],
  },

  'united states': {
    country: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    dailyDivisor: 23.83,
    deductions: [
      // id 'sfs'/'afp' map to the legacy health/pension slots so existing US paystub rows + tests hold.
      d('sfs', 'Medicare', 1.45),
      d('afp', 'Social Security', 6.2),
    ],
    incomeTaxName: 'Federal Income Tax',
    // 2025 single-filer brackets (on taxable income; standard deduction not auto-applied).
    incomeTaxBrackets: [
      { minAmount: 0, maxAmount: 11925, rate: 10, fixedAmount: 0 },
      { minAmount: 11925, maxAmount: 48475, rate: 12, fixedAmount: 1192.5 },
      { minAmount: 48475, maxAmount: 103350, rate: 22, fixedAmount: 5578.5 },
      { minAmount: 103350, maxAmount: 197300, rate: 24, fixedAmount: 17651 },
      { minAmount: 197300, maxAmount: 250525, rate: 32, fixedAmount: 40199 },
      { minAmount: 250525, maxAmount: 626350, rate: 35, fixedAmount: 57231 },
      { minAmount: 626350, maxAmount: null, rate: 37, fixedAmount: 188769.75 },
    ],
  },

  kenya: {
    country: 'Kenya',
    currency: 'KES',
    currencySymbol: 'KSh',
    dailyDivisor: 26,
    deductions: [
      d('nssf', 'NSSF', 6, 72000),
      d('shif', 'SHIF', 2.75),
      d('housing', 'Housing Levy', 1.5),
    ],
    incomeTaxName: 'PAYE',
    // Monthly bands × 12 (personal relief KES 2,400/mo is NOT auto-applied).
    incomeTaxBrackets: [
      { minAmount: 0, maxAmount: 288000, rate: 10, fixedAmount: 0 },
      { minAmount: 288000, maxAmount: 388000, rate: 25, fixedAmount: 28800 },
      { minAmount: 388000, maxAmount: 6000000, rate: 30, fixedAmount: 53800 },
      { minAmount: 6000000, maxAmount: 9600000, rate: 32.5, fixedAmount: 1737400 },
      { minAmount: 9600000, maxAmount: null, rate: 35, fixedAmount: 2907400 },
    ],
  },

  mexico: {
    country: 'Mexico',
    currency: 'MXN',
    currencySymbol: 'MX$',
    dailyDivisor: 30,
    deductions: [
      // Employee IMSS is branch-based (~2–3% of SBC); a single approximate line, editable.
      d('imss', 'IMSS', 2.375),
    ],
    incomeTaxName: 'ISR',
    // 2025 annual ISR tarifa.
    incomeTaxBrackets: [
      { minAmount: 0.01, maxAmount: 8952.49, rate: 1.92, fixedAmount: 0 },
      { minAmount: 8952.5, maxAmount: 75984.55, rate: 6.4, fixedAmount: 171.88 },
      { minAmount: 75984.56, maxAmount: 133536.07, rate: 10.88, fixedAmount: 4461.94 },
      { minAmount: 133536.08, maxAmount: 155229.8, rate: 16, fixedAmount: 10723.55 },
      { minAmount: 155229.81, maxAmount: 185852.57, rate: 17.92, fixedAmount: 14194.54 },
      { minAmount: 185852.58, maxAmount: 374837.88, rate: 21.36, fixedAmount: 19682.13 },
      { minAmount: 374837.89, maxAmount: 590795.99, rate: 23.52, fixedAmount: 60049.4 },
      { minAmount: 590796, maxAmount: 1127926.84, rate: 30, fixedAmount: 110842.74 },
      { minAmount: 1127926.85, maxAmount: 1503902.46, rate: 32, fixedAmount: 271981.99 },
      { minAmount: 1503902.47, maxAmount: 4511707.37, rate: 34, fixedAmount: 392294.17 },
      { minAmount: 4511707.38, maxAmount: null, rate: 35, fixedAmount: 1414947.85 },
    ],
  },

  'trinidad and tobago': {
    country: 'Trinidad and Tobago',
    currency: 'TTD',
    currencySymbol: 'TT$',
    dailyDivisor: 23.83,
    deductions: [
      // Statutory NIS is earnings-class based; ~5.4% employee share approximated, editable.
      d('nis', 'NIS', 5.4),
      // Health Surcharge: flat TT$8.25/week ≈ TT$35.75/month (set per your pay frequency).
      d('healthsurcharge', 'Health Surcharge', 0, null, { fixedAmount: 35.75 }),
    ],
    incomeTaxName: 'PAYE',
    // Personal allowance TT$90,000; 25% then 30% over chargeable TT$1,000,000.
    incomeTaxBrackets: [
      { minAmount: 0, maxAmount: 90000, rate: 0, fixedAmount: 0 },
      { minAmount: 90000, maxAmount: 1090000, rate: 25, fixedAmount: 0 },
      { minAmount: 1090000, maxAmount: null, rate: 30, fixedAmount: 250000 },
    ],
  },
}

/** Canonical lookup key for a country name (lowercased/trimmed), matching the registry keys. */
export function countryKey(country: string): string {
  const c = (country ?? '').toLowerCase().trim()
  if (c === 'us') return 'united states'
  if (c === 'ph') return 'philippines'
  if (c === 'jm') return 'jamaica'
  if (c === 'ke') return 'kenya'
  if (c === 'mx' || c.includes('méxic')) return 'mexico'
  if (c.includes('trinidad')) return 'trinidad and tobago'
  return c
}
