// Currency symbol per country. Used by payroll rules and the paystub (preview + PDF).
// Matches the country list used elsewhere (see countryFlag helpers).
const CURRENCY_SYMBOLS: { match: (c: string) => boolean; symbol: string }[] = [
  { match: (c) => c.includes('dominican') || c === 'do', symbol: 'RD$' },
  { match: (c) => c.includes('united states') || c === 'us', symbol: '$' },
  { match: (c) => c.includes('mexico') || c.includes('méxico'), symbol: 'MX$' },
  { match: (c) => c.includes('jamaica'), symbol: 'J$' },
  { match: (c) => c.includes('philippines') || c.includes('filipinas'), symbol: '₱' },
  { match: (c) => c.includes('kenya'), symbol: 'KSh' },
  { match: (c) => c.includes('haiti') || c.includes('haití'), symbol: 'G' },
  { match: (c) => c.includes('puerto rico'), symbol: '$' },
  { match: (c) => c.includes('canada') || c.includes('canadá'), symbol: 'CA$' },
  { match: (c) => c.includes('colombia'), symbol: 'COL$' },
  { match: (c) => c.includes('venezuela'), symbol: 'Bs.' },
  { match: (c) => c.includes('panama') || c.includes('panamá'), symbol: 'B/.' },
  { match: (c) => c.includes('costa rica'), symbol: '₡' },
  { match: (c) => c.includes('cuba'), symbol: '$' },
]

/**
 * Returns the currency symbol for an employee's country.
 * Falls back to '$' for any country not explicitly mapped.
 */
export function getCurrencySymbol(country: string | null | undefined): string {
  const c = (country ?? '').toLowerCase().trim()
  const found = CURRENCY_SYMBOLS.find((entry) => entry.match(c))
  return found?.symbol ?? '$'
}
