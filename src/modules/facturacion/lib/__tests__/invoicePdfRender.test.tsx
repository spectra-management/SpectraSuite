// @vitest-environment node
import { describe, it, expect } from 'vitest'
import React from 'react'
import * as RPDF from '@react-pdf/renderer'
import { InvoiceDocument, type InvoicePdfLabels } from '../invoicePdf'
import type { Invoice, BillingClient } from '../types'
import type { CompanySettings } from '@/shared/types'

const M = (RPDF as unknown as { default?: typeof RPDF }).default ?? RPDF
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdf = (M as any).pdf

const labels: InvoicePdfLabels = {
  invoice: 'Invoice', number: 'Invoice Number', issueDate: 'Invoice Date', period: 'Period',
  billTo: 'Accounts Payable', date: 'Date', description: 'Description', payClass: 'Pay Class',
  totalHours: 'Total Hours', hourlyRate: 'Hourly Rate', total: 'Total', totals: 'Totals',
  invoiceTotal: 'Invoice Total', remitIntro: 'Please remit payment to:', draftWatermark: 'DRAFT',
  generated: 'Generated', hoursDetailTitle: 'Hours Detail', employee: 'Employee',
  worked: 'Total Worked Hours', baseHours: 'Base Hours', overtimeHours: 'Overtime Hours',
}

const company = { name: 'Spectra', rnc: '1', address: 'Addr', phone: '', email: '', accentColor: '#059669', logoBase64: '' } as unknown as CompanySettings

const client: BillingClient = {
  id: 'c1', name: 'Reminder Media', division: '', contactName: 'Accounts Payable',
  contactEmail: '', contactPhone: '', billingAddress: '1100 First Avenue\nKing of Prussia, PA',
  remitToName: 'Spectra Healthcare Management, LLC', remitToAddress: '2040 Jimmy Buffett Mem Hwy',
  remitToDetails: 'or ACH', invoicePrefix: 'RM', nextInvoiceSeq: 1, defaultMethod: 'hour',
  currencyCountry: 'United States', notes: '', active: true, createdAt: '', updatedAt: '',
}

const invoice: Invoice = {
  id: 'i1', clientId: 'c1', number: 'RM02162026', status: 'finalized',
  periodStart: '2026-02-01', periodEnd: '2026-02-15', payrollRunIds: ['r1'],
  lineItems: [
    { id: 'l1', employeeId: 'e1', employeeName: 'Ana', title: 'Marketing Coaches', type: 'base', label: 'Base Pay', quantity: 750.25, rate: 9, amount: 6752.25, manual: false },
    { id: 'l2', employeeId: 'e2', employeeName: 'Bob', title: 'Marketing Coaches', type: 'overtime', label: 'Overtime Differential', quantity: 4, rate: 4.5, amount: 18, manual: false },
    { id: 'l3', employeeId: 'e1', employeeName: 'Ana', title: 'Marketing Coaches', type: 'bonus', label: 'KPI Bonus', quantity: 1, rate: 100, amount: 100, manual: true },
  ],
  subtotal: 6870.25, total: 6870.25, currencyCountry: 'United States', notes: '',
  issueDate: '2026-02-16', createdAt: '', updatedAt: '', finalizedAt: '2026-02-16', createdBy: null,
  clientNameSnapshot: 'Reminder Media',
}

async function renderBytes(el: React.ReactElement): Promise<number> {
  const buf = await pdf(el).toBuffer()
  const chunks: Buffer[] = []
  await new Promise<void>((res, rej) => { buf.on('data', (c: Buffer) => chunks.push(c)); buf.on('end', () => res()); buf.on('error', rej) })
  return Buffer.concat(chunks).length
}

describe('InvoiceDocument renders', () => {
  it('renders invoice + hours appendix to a non-empty PDF', async () => {
    const el = React.createElement(InvoiceDocument, { invoice, client, company, labels })
    expect(await renderBytes(el)).toBeGreaterThan(0)
  })

  it('renders a draft (no number) without throwing', async () => {
    const draft = { ...invoice, number: '', status: 'draft' as const }
    const el = React.createElement(InvoiceDocument, { invoice: draft, client, company, labels })
    expect(await renderBytes(el)).toBeGreaterThan(0)
  })
})
