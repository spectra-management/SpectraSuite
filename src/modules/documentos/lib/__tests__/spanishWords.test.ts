import { describe, it, expect } from 'vitest'
import { numeroALetras, montoEnLetras, fechaLegal } from '../spanishWords'

describe('numeroALetras', () => {
  it('handles units, teens and tens', () => {
    expect(numeroALetras(0)).toBe('cero')
    expect(numeroALetras(1)).toBe('uno')
    expect(numeroALetras(15)).toBe('quince')
    expect(numeroALetras(21)).toBe('veintiuno')
    expect(numeroALetras(30)).toBe('treinta')
    expect(numeroALetras(46)).toBe('cuarenta y seis')
  })

  it('handles hundreds and thousands', () => {
    expect(numeroALetras(100)).toBe('cien')
    expect(numeroALetras(101)).toBe('ciento uno')
    expect(numeroALetras(270)).toBe('doscientos setenta')
    expect(numeroALetras(2000)).toBe('dos mil')
    expect(numeroALetras(2026)).toBe('dos mil veintiséis')
    expect(numeroALetras(46819)).toBe('cuarenta y seis mil ochocientos diecinueve')
  })

  it('handles millions', () => {
    expect(numeroALetras(1_000_000)).toBe('un millón')
    expect(numeroALetras(2_500_000)).toBe('dos millones quinientos mil')
  })
})

describe('montoEnLetras', () => {
  it('spells the integer part and keeps cents as NN/100', () => {
    expect(montoEnLetras(270.11)).toBe('Doscientos setenta pesos dominicanos con 11/100')
    expect(montoEnLetras(46819.07)).toBe('Cuarenta y seis mil ochocientos diecinueve pesos dominicanos con 07/100')
    expect(montoEnLetras(0)).toBe('Cero pesos dominicanos con 00/100')
  })
})

describe('fechaLegal', () => {
  it('produces the legal date phrase', () => {
    expect(fechaLegal('2026-06-03')).toBe('a los tres (03) días del mes de junio del año dos mil veintiséis (2026)')
    expect(fechaLegal('2025-11-26')).toBe('a los veintiséis (26) días del mes de noviembre del año dos mil veinticinco (2025)')
  })

  it('uses the singular "primer día" form for day 1', () => {
    expect(fechaLegal('2026-01-01')).toBe('al primer (01) día del mes de enero del año dos mil veintiséis (2026)')
  })

  it('returns empty string for empty/invalid input', () => {
    expect(fechaLegal('')).toBe('')
    expect(fechaLegal('not-a-date')).toBe('')
  })
})
