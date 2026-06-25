// @vitest-environment node
import { describe, it, expect } from 'vitest'
import React from 'react'
import * as RPDF from '@react-pdf/renderer'
import { PayStubDocument } from '../payStubPdf'
import { ROBOTO_REGULAR, ROBOTO_BOLD } from '../robotoFont'
import type { PayrollEntry } from '@/shared/types'

const M = (RPDF as unknown as { default?: typeof RPDF }).default ?? RPDF
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Font = (M as any).Font
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdf = (M as any).pdf

Font.register({
  family: 'Roboto',
  fonts: [
    { src: ROBOTO_REGULAR, fontWeight: 'normal' },
    { src: ROBOTO_BOLD, fontWeight: 'bold' },
  ],
})

const company = {
  name: 'Compañía Peña S.A.', rnc: '1-23', address: 'x', phone: 'y',
  email: 'z', accentColor: '#059669', logoBase64: '',
}

// Deliberately sparse calculation — simulates a Salary employee / legacy saved entry
// where several numeric fields are undefined.
function entryWith(overrides: Record<string, unknown>): PayrollEntry {
  // Intentionally partial / undefined-valued objects to exercise the PDF's
  // missing-data handling; cast via `unknown` to the real field types.
  return {
    employee: { id: '1', firstName: 'Idaly', lastName: 'Peña', workEmail: '', payRate: 0, payType: 'Salary', jobTitle: 'x', department: 'y', hireDate: '', status: 'Active' } as unknown as PayrollEntry['employee'],
    hours: { employeeId: '1', regularHours: undefined, otHours: undefined, holidayHours: undefined, source: 'manual' } as unknown as PayrollEntry['hours'],
    calculation: { regularPay: undefined, otPay: undefined, holidayPay: undefined, grossPay: undefined, afpAmount: undefined, sfsAmount: undefined, isrPeriod: undefined, isrMonthlyBase: undefined, totalDeductions: undefined, netPay: undefined, customDeductionsBreakdown: [], customDeductions: undefined, ...overrides } as unknown as PayrollEntry['calculation'],
  }
}

async function render(entry: PayrollEntry) {
  const el = React.createElement(PayStubDocument, {
    entry, company: company as never, startDate: '2026-03-16', endDate: '2026-03-31', lang: 'en', country: 'Dominican Republic',
  })
  const buf = await pdf(el).toBuffer()
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    buf.on('data', (c: Buffer) => chunks.push(c)); buf.on('end', () => resolve()); buf.on('error', reject)
  })
  return Buffer.concat(chunks).length
}

describe('font sanity', () => {
  it('minimal doc with Roboto + backgroundColor + borderRadius renders', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const A: any = M
    const el = React.createElement(A.Document, null,
      React.createElement(A.Page, { style: { fontFamily: 'Roboto', padding: 20 } },
        React.createElement(A.View, { style: { backgroundColor: '#059669', borderTopLeftRadius: 4, borderTopRightRadius: 4, padding: 6 } },
          React.createElement(A.Text, { style: { fontFamily: 'Roboto', fontWeight: 700 } }, 'Peña 123'))))
    const buf = await pdf(el).toBuffer()
    const chunks: Buffer[] = []
    await new Promise<void>((res, rej) => { buf.on('data', (c: Buffer) => chunks.push(c)); buf.on('end', () => res()); buf.on('error', rej) })
    expect(Buffer.concat(chunks).length).toBeGreaterThan(0)
  })
})

describe('PayStubDocument renders without NaN', () => {
  it('renders with all-zero numeric fields', async () => {
    const zero = entryWith({ regularPay: 0, otPay: 0, holidayPay: 0, grossPay: 0, afpAmount: 0, sfsAmount: 0, isrPeriod: 0, isrMonthlyBase: 0, totalDeductions: 0, netPay: 0, customDeductions: 0 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(zero.hours as any).regularHours = 96; (zero.hours as any).otHours = 0; (zero.hours as any).holidayHours = 0
    expect(await render(zero)).toBeGreaterThan(0)
  })

  it('renders with undefined numeric fields (no "unsupported number: NaN")', async () => {
    const el = React.createElement(PayStubDocument, {
      entry: entryWith({}), company: company as never, startDate: '2026-03-16', endDate: '2026-03-31', lang: 'en', country: 'Dominican Republic',
    })
    const buf = await pdf(el).toBuffer()
    // toBuffer returns a stream in node — drain it to force full layout/render.
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      buf.on('data', (c: Buffer) => chunks.push(c))
      buf.on('end', () => resolve())
      buf.on('error', reject)
    })
    expect(Buffer.concat(chunks).length).toBeGreaterThan(0)
  })
})
