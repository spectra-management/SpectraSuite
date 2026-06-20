import { describe, it, expect, beforeEach } from 'vitest'
import {
  getHolidays, getHolidaysInRange, addManualHoliday, deleteHoliday, NAGER_COUNTRY_CODE,
} from '../holidays'

beforeEach(() => localStorage.clear())

describe('holidays library', () => {
  it('maps country names to Nager.Date codes', () => {
    expect(NAGER_COUNTRY_CODE['Dominican Republic']).toBe('DO')
    expect(NAGER_COUNTRY_CODE['Mexico']).toBe('MX')
    expect(NAGER_COUNTRY_CODE['United States']).toBe('US')
    expect(NAGER_COUNTRY_CODE['Jamaica']).toBe('JM')
    expect(NAGER_COUNTRY_CODE['Philippines']).toBe('PH')
    expect(NAGER_COUNTRY_CODE['Kenya']).toBe('KE')
  })

  it('DR falls back to computed statutory holidays before any sync', () => {
    // Jan 1 (New Year) always falls in this range and is statutory.
    const range = getHolidaysInRange('Dominican Republic', '2026-01-01', '2026-01-31')
    expect(range.some((h) => h.date === '2026-01-01')).toBe(true)
    expect(range.every((h) => h.source === 'auto')).toBe(true)
  })

  it('non-DR country with no stored holidays returns empty', () => {
    expect(getHolidaysInRange('Kenya', '2026-01-01', '2026-12-31')).toEqual([])
  })

  it('adds a manual holiday and rejects a duplicate date', () => {
    expect(addManualHoliday('Mexico', 2026, '2026-05-05', 'Cinco de Mayo', 'Decreto')).toBe(true)
    expect(addManualHoliday('Mexico', 2026, '2026-05-05', 'Duplicate')).toBe(false)
    const list = getHolidays('Mexico', 2026)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ date: '2026-05-05', name: 'Cinco de Mayo', source: 'manual', note: 'Decreto' })
  })

  it('finds a registered holiday within a pay period (Corpus Christi Jun 4 in Jun 1-15)', () => {
    addManualHoliday('Dominican Republic', 2026, '2026-06-04', 'Corpus Christi')
    const inRange = getHolidaysInRange('Dominican Republic', '2026-06-01', '2026-06-15')
    const corpus = inRange.find((h) => h.date === '2026-06-04')
    expect(corpus?.name).toBe('Corpus Christi')
    // Exact-string range bounds: a holiday outside the period is excluded.
    expect(getHolidaysInRange('Dominican Republic', '2026-06-05', '2026-06-15')
      .some((h) => h.date === '2026-06-04')).toBe(false)
  })

  it('deletes a holiday by id', () => {
    addManualHoliday('Mexico', 2026, '2026-05-05', 'Cinco de Mayo')
    const id = getHolidays('Mexico', 2026)[0].id
    deleteHoliday('Mexico', 2026, id)
    expect(getHolidays('Mexico', 2026)).toHaveLength(0)
  })
})
