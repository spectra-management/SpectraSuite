import { describe, it, expect } from 'vitest'
import { findCedulaByValue } from '../bamboohr-hr'

describe('findCedulaByValue', () => {
  it('finds a DR cédula by its 11-digit shape regardless of field name', () => {
    const row = { '4408': '001-1234567-8', firstName: 'Idaly', mobilePhone: '829-332-6322' }
    expect(findCedulaByValue(row)).toBe('001-1234567-8')
  })

  it('matches an undashed 11-digit cédula too', () => {
    expect(findCedulaByValue({ custom: '00112345678' })).toBe('00112345678')
  })

  it('does NOT match a phone (10 digits) or an RNC (9 digits)', () => {
    expect(findCedulaByValue({ mobilePhone: '829-332-6322', rnc: '130824510' })).toBe('')
  })

  it('returns empty string when no value looks like a cédula', () => {
    expect(findCedulaByValue({ a: 'foo', b: '', c: '2024-03-01' })).toBe('')
  })
})
