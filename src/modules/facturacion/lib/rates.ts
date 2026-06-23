/**
 * Rate resolution.
 *
 * Priority (per the billing model):
 *   1. TITLE RATE (base) — per client, a rate per job title.
 *   2. PER-EMPLOYEE OVERRIDE — wins over the title rate when set.
 * Billing method: per-employee override falls back to the client default.
 */

import { safeNum } from '@/shared/lib/number'
import type { BillingClient, ClientEmployee, TitleRate, BillingMethod } from './types'

export interface ResolvedRate {
  method: BillingMethod
  /** Base hourly rate ('hour' method). */
  baseRate: number
  /** Overtime hourly rate ('hour' method). */
  otRate: number
  /** Flat amount per period ('fixed' method). */
  fixedAmount: number
  /** Percentage of pay, e.g. 15 = 15% ('percentage' method). */
  percentageRate: number
  /** Whether a rate was actually found (title rate or override) — for warnings. */
  hasBaseRate: boolean
}

/** Find the title rate row for a client + job title (case-insensitive trim). */
export function findTitleRate(
  titleRates: TitleRate[],
  clientId: string,
  title: string,
): TitleRate | undefined {
  const key = title.trim().toLowerCase()
  return titleRates.find(
    (r) => r.clientId === clientId && r.title.trim().toLowerCase() === key,
  )
}

/**
 * Resolve the effective rate for one assigned employee.
 * `titleRate` is the matching title-rate row (may be undefined if none defined).
 */
export function resolveRate(
  client: BillingClient,
  assignment: ClientEmployee,
  titleRate: TitleRate | undefined,
): ResolvedRate {
  const method: BillingMethod = assignment.method ?? client.defaultMethod

  const titleBase = titleRate ? safeNum(titleRate.baseRate) : null
  const titleOt = titleRate ? safeNum(titleRate.otRate) : null

  const baseRate = assignment.baseRateOverride != null ? safeNum(assignment.baseRateOverride) : (titleBase ?? 0)
  const otRate = assignment.otRateOverride != null ? safeNum(assignment.otRateOverride) : (titleOt ?? 0)

  const hasBaseRate = assignment.baseRateOverride != null || titleBase != null

  return {
    method,
    baseRate,
    otRate,
    fixedAmount: safeNum(assignment.fixedAmount),
    percentageRate: safeNum(assignment.percentageRate),
    hasBaseRate,
  }
}
