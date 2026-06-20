import { describe, it, expect } from 'vitest'
import { getPaystubLang, PAYSTUB_LABELS, PAYMENT_METHOD_LABELS } from '../paystubLabels'

describe('getPaystubLang (paystub language by country)', () => {
  it('Dominican Republic & Mexico → Spanish', () => {
    expect(getPaystubLang('Dominican Republic')).toBe('es')
    expect(getPaystubLang('Mexico')).toBe('es')
    expect(getPaystubLang('México')).toBe('es')
  })

  it('every other country (and unknown) → English', () => {
    expect(getPaystubLang('United States')).toBe('en')
    expect(getPaystubLang('Jamaica')).toBe('en')
    expect(getPaystubLang('')).toBe('en')
    expect(getPaystubLang(undefined)).toBe('en')
  })

  it('key labels match the required translations', () => {
    expect(PAYSTUB_LABELS.es.stub).toBe('RECIBO DE PAGO')
    expect(PAYSTUB_LABELS.es.netPay).toBe('INGRESO NETO')
    expect(PAYSTUB_LABELS.en.stub).toBe('PAYSTUB')
    expect(PAYMENT_METHOD_LABELS.es.transfer).toBe('Transferencia')
    expect(PAYMENT_METHOD_LABELS.en.transfer).toBe('Bank Transfer')
  })
})
