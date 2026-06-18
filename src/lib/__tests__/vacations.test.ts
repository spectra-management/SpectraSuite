import { describe, it, expect, beforeEach } from 'vitest'
import {
  defaultVacationRules, getVacationRules, isVacationConfigured, saveVacationRules,
  getVacationDays, calculateVacationPay, calculateVacationPayForDays,
} from '../vacations'
import { calculateAnnualISR, roundHalfUp } from '../payroll/calculations'
import { DEFAULT_FISCAL_PARAMETERS } from '../payroll/constants'

beforeEach(() => localStorage.clear())

describe('vacation rules', () => {
  it('DR is pre-configured with statutory tiers; others are not', () => {
    expect(isVacationConfigured('Dominican Republic')).toBe(true)
    expect(isVacationConfigured('Kenya')).toBe(false)
    const dr = getVacationRules('Dominican Republic')!
    expect(dr.tiers.map((t) => t.days)).toEqual([14, 18, 23])
    expect(dr.payStubLanguage).toBe('es')
    expect(getVacationRules('Kenya')).toBeNull()
  })

  it('default language is Spanish for Mexico, English for others', () => {
    expect(defaultVacationRules('Mexico').payStubLanguage).toBe('es')
    expect(defaultVacationRules('Jamaica').payStubLanguage).toBe('en')
  })

  it('getVacationDays maps seniority to the right tier', () => {
    const dr = getVacationRules('Dominican Republic')!
    expect(getVacationDays(dr.tiers, 3)).toBe(14)
    expect(getVacationDays(dr.tiers, 7)).toBe(18)
    expect(getVacationDays(dr.tiers, 12)).toBe(23)
    expect(getVacationDays(dr.tiers, 0)).toBe(0)
  })

  it('calculateVacationPay uses the formula (avgMonthly ÷ divisor × days)', () => {
    const r = calculateVacationPay('Dominican Republic', 200, 3)!
    // avgMonthly = 200×40×50/12 = 33,333.33; daily = /23.83 = 1,398.80; gross = ×14
    expect(r.days).toBe(14)
    expect(r.averageMonthlySalary).toBeCloseTo(33333.33, 2)
    expect(r.gross).toBeCloseTo(r.dailySalary * 14, 2)
    expect(r.net).toBeLessThan(r.gross) // SFS + AFP deducted by default
  })

  it('reflects edited parameters saved to storage (not hardcoded)', () => {
    const before = calculateVacationPay('Dominican Republic', 200, 3)!.gross
    const rules = getVacationRules('Dominican Republic')!
    saveVacationRules('Dominican Republic', { ...rules, formula: { ...rules.formula, weeksPerYear: 52 } })
    const after = calculateVacationPay('Dominican Republic', 200, 3)!.gross
    expect(after).toBeGreaterThan(before)
  })

  it('returns null for an unconfigured country', () => {
    expect(calculateVacationPay('Kenya', 200, 3)).toBeNull()
  })

  it('vacation ISR = annualized (×12) DGII ÷ 12, and is NOT deducted from net', () => {
    const brackets = DEFAULT_FISCAL_PARAMETERS.isrBrackets
    const r = calculateVacationPayForDays('Dominican Republic', 69440, 14, 'Salary', { isrBrackets: brackets })!
    const expectedIsr = roundHalfUp(calculateAnnualISR(roundHalfUp(r.gross * 12), brackets) / 12)
    expect(r.isrAmount).toBe(expectedIsr)
    expect(r.isrAmount).toBeGreaterThan(0)
    // net excludes ISR (only SFS + AFP deducted)
    expect(r.net).toBeCloseTo(r.gross - r.sfsAmount - r.afpAmount, 2)
  })

  it('vacation ISR is 0 when no brackets are provided', () => {
    const r = calculateVacationPayForDays('Dominican Republic', 69440, 14, 'Salary')!
    expect(r.isrAmount).toBe(0)
  })

  it('Salary: payRate IS the monthly salary (no hourly annualization)', () => {
    // payRate 69,440/month, 3 yrs → 14 days; daily = 69,440 / 23.83 = 2,913.97; gross = ×14
    const r = calculateVacationPay('Dominican Republic', 69440, 3, 'Salary')!
    expect(r.days).toBe(14)
    expect(r.averageMonthlySalary).toBe(69440)
    expect(r.dailySalary).toBeCloseTo(2913.97, 2)
    expect(r.gross).toBeCloseTo(40795.58, 2)
  })

  it('Hourly default still annualizes via the formula', () => {
    const hourly = calculateVacationPay('Dominican Republic', 200, 3)!          // default Hourly
    const salary = calculateVacationPay('Dominican Republic', 200, 3, 'Salary')!
    expect(hourly.averageMonthlySalary).toBeCloseTo(33333.33, 2) // 200×40×50/12
    expect(salary.averageMonthlySalary).toBe(200)                // used directly
    expect(hourly.gross).not.toBe(salary.gross)
  })
})
