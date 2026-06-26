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

  it('requests only text/ssn-type fields (never time_off/benefit/etc. that 500 the report) and detects the cédula', async () => {
    // Mirrors the live spectrahm account: the cédula is a text custom field ("Cedula"),
    // alongside field types that crash a custom report if requested.
    const META = [
      { id: 4554, name: 'Cedula', type: 'text', alias: 'customNIDS' },
      { id: 4573, name: 'Accrued Sick Leave - Policy Assigned', type: 'time_off_type_exists' },
      { id: '4573.6', name: 'Accrued Sick Leave - Adjustments (YTD)', type: 'int' },
      { id: 1502, name: 'Benefit History', type: 'benefit_history' },
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
      // The custom report POST — capture the requested field list and reject any unsafe type.
      postedFields = JSON.parse(String(init?.body)).fields
      const unsafe = postedFields.filter((f) => ['4573', '4573.6', '1502', '4510'].includes(f))
      if (unsafe.length) return { ok: false, status: 500, json: async () => ({ error: 'BambooHR API error' }) } as Response
      return { ok: true, json: async () => REPORT } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const rows = await fetchHrDirectory('spectrahm', 'key')

    // Never requested the crashing field types…
    expect(postedFields).not.toContain('4573')
    expect(postedFields).not.toContain('4573.6')
    expect(postedFields).not.toContain('1502')
    expect(postedFields).not.toContain('4510')
    // …did request the text cédula field, and surfaced the value.
    expect(postedFields).toContain('4554')
    expect(rows[0].nationalId).toBe('031-0398291-8')
  })
})
