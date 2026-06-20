import { roundHalfUp } from '@/modules/nomina/lib/payroll/calculations'
import type { PayrollRules } from './types'

// US Federal holidays 2025 and 2026
const US_HOLIDAYS: string[] = [
  // 2025
  '2025-01-01', '2025-01-20', '2025-02-17', '2025-05-26', '2025-06-19',
  '2025-07-04', '2025-09-01', '2025-10-13', '2025-11-11', '2025-11-27', '2025-12-25',
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-05-25', '2026-06-19',
  '2026-07-03', '2026-09-07', '2026-10-12', '2026-11-11', '2026-11-26', '2026-12-25',
]

// US Federal Income Tax (single filer 2024 brackets)
function calculateUSFederalIncomeTax(annualGross: number): number {
  if (annualGross <= 0) return 0

  if (annualGross <= 11600) {
    return roundHalfUp(annualGross * 0.10)
  }
  if (annualGross <= 47150) {
    return roundHalfUp(1160 + (annualGross - 11600) * 0.12)
  }
  if (annualGross <= 100525) {
    return roundHalfUp(5426 + (annualGross - 47150) * 0.22)
  }
  if (annualGross <= 191950) {
    return roundHalfUp(17168.50 + (annualGross - 100525) * 0.24)
  }
  if (annualGross <= 243725) {
    return roundHalfUp(39110.50 + (annualGross - 191950) * 0.32)
  }
  return roundHalfUp(55678.50 + (annualGross - 243725) * 0.35)
}

export function getUSPayrollRules(frequency: 'biweekly' | 'weekly' | 'full_month'): PayrollRules {
  const payPeriodsPerYear = frequency === 'full_month' ? 12 : frequency === 'biweekly' ? 24 : 52

  // Social Security 6.2% annual cap $168,600 → per-period cap
  const ssCap = roundHalfUp(168600 / payPeriodsPerYear)

  return {
    country: 'United States',
    currency: 'USD',
    currencySymbol: '$',
    healthInsuranceRate: 1.45,         // Medicare
    pensionRate: 6.2,                  // Social Security
    healthInsuranceName: 'Medicare (1.45%)',
    pensionName: 'Social Security (6.2%)',
    healthInsuranceCap: null,          // Medicare has no annual cap
    pensionCap: ssCap,                 // Social Security per-period cap
    calculateIncomeTax: calculateUSFederalIncomeTax,
    incomeTaxName: 'Federal Income Tax',
    payPeriodsPerYear,
    otThresholdHours: 40,
    holidays: US_HOLIDAYS,
    dailyDivisor: 21.67,
  }
}
