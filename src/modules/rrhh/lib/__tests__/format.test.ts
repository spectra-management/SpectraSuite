import { describe, it, expect } from 'vitest'
import { maskNationalId, compRateDisplay } from '../format'
import type { RrhhCompensationEntry } from '@/modules/rrhh/types'

function comp(over: Partial<RrhhCompensationEntry>): RrhhCompensationEntry {
  return {
    id: '1',
    startDate: '2024-01-01',
    rate: 0,
    currency: '',
    paidPer: '',
    type: '',
    reason: '',
    ...over,
  }
}

describe('maskNationalId', () => {
  it('reveals only the last 4 characters', () => {
    expect(maskNationalId('001-1234567-8')).toBe('•••• •••• 5678')
    expect(maskNationalId('123456789')).toBe('•••• •••• 6789')
  })

  it('returns a dash for empty/blank input', () => {
    expect(maskNationalId('')).toBe('—')
    expect(maskNationalId('   ')).toBe('—')
    expect(maskNationalId(undefined)).toBe('—')
  })

  it('handles short values without throwing', () => {
    expect(maskNationalId('12')).toBe('•••• •••• 12')
  })
})

describe('compRateDisplay', () => {
  it('suffixes the pay frequency', () => {
    expect(compRateDisplay(comp({ rate: 150, currency: 'DOP', paidPer: 'Hour' }))).toContain('/hr')
    expect(compRateDisplay(comp({ rate: 80000, currency: 'DOP', paidPer: 'Year' }))).toContain('/yr')
    expect(compRateDisplay(comp({ rate: 5000, currency: 'DOP', paidPer: 'Month' }))).toContain('/mo')
  })

  it('returns a dash when there is no rate', () => {
    expect(compRateDisplay(comp({ rate: 0, currency: '' }))).toBe('—')
  })
})
