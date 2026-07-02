import type { CustomDeduction, InsuranceDependent } from '@/shared/types'
import { roundHalfUp } from './calculations'

/**
 * Derive the auto "Dependent TSS" / "Complementary Insurance" payroll deductions
 * from the employee's RRHH insurance dependents.
 *
 * The dependents record a MONTHLY cost per person; payroll deductions apply per
 * run, so the per-coverage monthly total is prorated by pay frequency:
 * biweekly ÷ 2, weekly ÷ 4, full month × 1.
 *
 * Merge rule: when a coverage has a positive monthly total, its auto deduction
 * REPLACES any manual deduction with a matching name (no double-charge). With no
 * dependents (or zero cost) the manual deductions pass through untouched, so
 * employees configured before this feature keep working as before.
 *
 * The auto names match the paystub's keyword lookups ("dependent tss" /
 * "complementary"), so the amounts land on their fixed paystub rows.
 */

const PERIODS_PER_MONTH: Record<'biweekly' | 'weekly' | 'full_month', number> = {
  biweekly: 2,
  weekly: 4,
  full_month: 1,
}

/** Deduction names the TSS-dependents auto row replaces. */
function isTssDependentDeduction(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('depend') && n.includes('tss')
}

/** Deduction names the complementary-insurance auto row replaces. */
function isComplementaryDeduction(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('complementary') || n.includes('complementario')
}

/**
 * Merge the dependents-derived deductions into an employee's (already
 * active-filtered) custom deductions for one payroll run.
 */
export function withDependentDeductions(
  deductions: CustomDeduction[],
  dependents: InsuranceDependent[],
  frequency: 'biweekly' | 'weekly' | 'full_month',
): CustomDeduction[] {
  const periods = PERIODS_PER_MONTH[frequency]
  const monthlyTotal = (coverage: InsuranceDependent['coverage']) =>
    dependents
      .filter((d) => d.coverage === coverage)
      .reduce((sum, d) => sum + Math.max(0, d.monthlyCost || 0), 0)

  const tssPerPeriod = roundHalfUp(monthlyTotal('tss') / periods)
  const compPerPeriod = roundHalfUp(monthlyTotal('complementary') / periods)

  let result = [...deductions]

  if (tssPerPeriod > 0) {
    result = result.filter((d) => !isTssDependentDeduction(d.name))
    result.push({
      id: 'auto_dependent_tss',
      name: 'Dependent TSS',
      type: 'fixed',
      amount: tssPerPeriod,
      recurring: true,
      active: true,
    })
  }

  if (compPerPeriod > 0) {
    result = result.filter((d) => !isComplementaryDeduction(d.name))
    result.push({
      id: 'auto_complementary_insurance',
      name: 'Complementary Insurance',
      type: 'fixed',
      amount: compPerPeriod,
      recurring: true,
      active: true,
    })
  }

  return result
}
