import { describe, it, expect, vi, afterEach } from 'vitest'
import { findCedulaByValue, fetchHrDirectory, detectCedula } from '../bamboohr-hr'

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

describe('detectCedula', () => {
  it('prefers the name-matched field, then a cédula-shaped value, then the SSN fallback', () => {
    // 1. named field wins even when another value also looks like a cédula
    expect(detectCedula({ customNIDS: '402-2410389-1', other: '001-1234567-8' }, 'customNIDS', '')).toBe('402-2410389-1')
    // 2. no named field → value scan
    expect(detectCedula({ x: '031-0398291-8' }, null, '')).toBe('031-0398291-8')
    // 3. nothing detected → SSN fallback
    expect(detectCedula({ x: 'foo' }, null, '010-20-3040')).toBe('010-20-3040')
    // 4. named field present but empty → fall through to value scan
    expect(detectCedula({ customNIDS: '', x: '037-0116342-4' }, 'customNIDS', '')).toBe('037-0116342-4')
  })
})

describe('fetchHrDirectory field selection', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests ONLY the name-matched cédula field (not every text/other field, which 500s or multiplies report rows) and detects it', async () => {
    // Mirrors the live spectrahm account: the cédula is a custom field ("Cedula" → customNIDS).
    // Other fields must NOT be bulk-requested: numeric/currency/etc. 500 the report, and some
    // text fields are table/repeating fields that multiply the rows.
    const META = [
      { id: 4554, name: 'Cedula', type: 'text', alias: 'customNIDS' },
      { id: 4400, name: 'T-Shirt Size', type: 'text', alias: 'customTShirt' },
      { id: 4510, name: 'Annual Amount', type: 'currency', alias: 'amount' },
    ]
    const REPORT = {
      employees: [
        { id: '116', firstName: 'Mario', lastName: 'Guzman', ssn: null, customNIDS: '031-0398291-8' },
      ],
    }

    let postedFields: string[] = []
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      // NB: URLSearchParams percent-encodes the path slashes, so match on 'meta', not '/v1/meta/fields'.
      if (url.includes('meta')) {
        return { ok: true, json: async () => META } as Response
      }
      postedFields = JSON.parse(String(init?.body)).fields
      return { ok: true, json: async () => REPORT } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const rows = await fetchHrDirectory('spectrahm', 'key')

    // Requested exactly one extra field — the cédula — and no other custom fields.
    expect(postedFields).toContain('customNIDS')
    expect(postedFields).not.toContain('customTShirt')
    expect(postedFields).not.toContain('4400')
    expect(postedFields).not.toContain('4510')
    expect(rows[0].nationalId).toBe('031-0398291-8')
  })
})
