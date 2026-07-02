import { describe, it, expect } from 'vitest'
import { withDependentDeductions } from '../dependentDeductions'
import type { CustomDeduction, InsuranceDependent } from '@/shared/types'

function dep(overrides: Partial<InsuranceDependent>): InsuranceDependent {
  return {
    id: 'd1',
    name: 'Ana Pérez',
    relationship: 'child',
    nationalId: '',
    birthDate: '2015-04-10',
    gender: 'F',
    coverage: 'tss',
    monthlyCost: 0,
    ...overrides,
  }
}

function ded(overrides: Partial<CustomDeduction>): CustomDeduction {
  return {
    id: 'm1',
    name: 'Pay Advance',
    type: 'fixed',
    amount: 500,
    recurring: true,
    active: true,
    ...overrides,
  }
}

describe('withDependentDeductions', () => {
  it('returns manual deductions untouched when there are no dependents', () => {
    const manual = [ded({ name: 'Dependent TSS', amount: 300 })]
    expect(withDependentDeductions(manual, [], 'biweekly')).toEqual(manual)
  })

  it('returns manual deductions untouched when dependents have zero cost', () => {
    const manual = [ded({ name: 'Dependent TSS', amount: 300 })]
    const deps = [dep({ coverage: 'tss', monthlyCost: 0 })]
    expect(withDependentDeductions(manual, deps, 'biweekly')).toEqual(manual)
  })

  it('prorates the monthly TSS total per quincena (biweekly ÷ 2)', () => {
    const deps = [
      dep({ id: 'a', coverage: 'tss', monthlyCost: 1000 }),
      dep({ id: 'b', coverage: 'tss', monthlyCost: 500 }),
    ]
    const out = withDependentDeductions([], deps, 'biweekly')
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ name: 'Dependent TSS', type: 'fixed', amount: 750, active: true })
  })

  it('prorates weekly ÷ 4 and full_month × 1', () => {
    const deps = [dep({ coverage: 'complementary', monthlyCost: 1000 })]
    expect(withDependentDeductions([], deps, 'weekly')[0].amount).toBe(250)
    expect(withDependentDeductions([], deps, 'full_month')[0].amount).toBe(1000)
  })

  it('splits coverages into their own deduction rows', () => {
    const deps = [
      dep({ id: 'a', coverage: 'tss', monthlyCost: 800 }),
      dep({ id: 'b', coverage: 'complementary', monthlyCost: 1200 }),
    ]
    const out = withDependentDeductions([], deps, 'biweekly')
    expect(out.map((d) => [d.name, d.amount])).toEqual([
      ['Dependent TSS', 400],
      ['Complementary Insurance', 600],
    ])
  })

  it('replaces matching manual deductions instead of duplicating them', () => {
    const manual = [
      ded({ id: 'm1', name: 'Dependent TSS', amount: 999 }),
      ded({ id: 'm2', name: 'Seguro Complementario Dependiente', amount: 888 }),
      ded({ id: 'm3', name: 'Pay Advance', amount: 500 }),
    ]
    const deps = [
      dep({ id: 'a', coverage: 'tss', monthlyCost: 1000 }),
      dep({ id: 'b', coverage: 'complementary', monthlyCost: 600 }),
    ]
    const out = withDependentDeductions(manual, deps, 'biweekly')
    const names = out.map((d) => d.name)
    expect(names).toContain('Pay Advance')
    expect(names).toContain('Dependent TSS')
    expect(names).toContain('Complementary Insurance')
    expect(out).toHaveLength(3)
    expect(out.find((d) => d.name === 'Dependent TSS')?.amount).toBe(500)
    expect(out.find((d) => d.name === 'Complementary Insurance')?.amount).toBe(300)
  })

  it('keeps a manual complementary deduction when only TSS dependents exist', () => {
    const manual = [ded({ id: 'm2', name: 'Complementary Insurance', amount: 888 })]
    const deps = [dep({ coverage: 'tss', monthlyCost: 1000 })]
    const out = withDependentDeductions(manual, deps, 'biweekly')
    expect(out.find((d) => d.name === 'Complementary Insurance')?.amount).toBe(888)
    expect(out.find((d) => d.name === 'Dependent TSS')?.amount).toBe(500)
  })

  it('rounds half-up to 2 decimals', () => {
    // 1000.01 / 2 = 500.005 → 500.01
    const deps = [dep({ coverage: 'tss', monthlyCost: 1000.01 })]
    expect(withDependentDeductions([], deps, 'biweekly')[0].amount).toBe(500.01)
  })

  it('ignores negative monthly costs', () => {
    const deps = [
      dep({ id: 'a', coverage: 'tss', monthlyCost: -50 }),
      dep({ id: 'b', coverage: 'tss', monthlyCost: 100 }),
    ]
    expect(withDependentDeductions([], deps, 'biweekly')[0].amount).toBe(50)
  })
})
