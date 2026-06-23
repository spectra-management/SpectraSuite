import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type { CompanySettings } from '@/shared/types'
import type { BillingClient, Invoice, InvoiceLineItem } from './types'
import { formatMoneyPdf, formatHours } from './format'

const EMERALD = '#059669'
const EMERALD_DARK = '#065F46'
const EMERALD_LIGHT = '#ECFDF5'
const GRAY_50 = '#F9FAFB'
const GRAY_100 = '#F3F4F6'
const GRAY_200 = '#E5E7EB'
const GRAY_500 = '#6B7280'
const GRAY_700 = '#374151'
const GRAY_900 = '#111827'

const S = StyleSheet.create({
  page: { fontSize: 9, padding: '32 40', backgroundColor: '#FFFFFF', color: GRAY_900 },

  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 14, borderBottom: `1 solid ${GRAY_200}` },
  logoWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  logo: { width: 44, height: 44, borderRadius: 5, objectFit: 'contain' },
  companyName: { fontSize: 14, fontWeight: 700, color: EMERALD, marginBottom: 2 },
  companyMeta: { fontSize: 8, color: GRAY_500, marginTop: 1 },
  headerRight: { alignItems: 'flex-end' },
  invoiceTitle: { fontSize: 18, fontWeight: 700, color: GRAY_900, letterSpacing: 1.5, marginBottom: 4 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 2, justifyContent: 'flex-end' },
  metaLabel: { fontSize: 8, color: GRAY_500 },
  metaValue: { fontSize: 8, fontWeight: 700, color: GRAY_700 },

  partiesRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginBottom: 16 },
  partyBox: { flex: 1, backgroundColor: GRAY_50, borderLeft: `3 solid ${EMERALD}`, borderRadius: 5, padding: '9 12' },
  partyLabel: { fontSize: 7.5, color: GRAY_500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  partyName: { fontSize: 10, fontWeight: 700, color: GRAY_900, marginBottom: 2 },
  partyLine: { fontSize: 8, color: GRAY_700, marginTop: 1 },

  // Table
  tHead: { flexDirection: 'row', backgroundColor: EMERALD, borderTopLeftRadius: 4, borderTopRightRadius: 4, padding: '6 8' },
  th: { fontSize: 8, fontWeight: 700, color: '#FFFFFF' },
  tRow: { flexDirection: 'row', padding: '5 8', borderBottom: `0.5 solid ${GRAY_100}` },
  tRowAlt: { backgroundColor: GRAY_50 },
  td: { fontSize: 8.5, color: GRAY_700 },
  tdBold: { fontSize: 8.5, fontWeight: 700, color: GRAY_900 },

  colEmp: { width: '34%' },
  colDesc: { width: '26%' },
  colQty: { width: '12%', textAlign: 'right' },
  colRate: { width: '14%', textAlign: 'right' },
  colAmt: { width: '14%', textAlign: 'right' },

  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  totalBox: { width: '40%' },
  totalLine: { flexDirection: 'row', justifyContent: 'space-between', padding: '4 8' },
  grandLine: { flexDirection: 'row', justifyContent: 'space-between', padding: '7 8', backgroundColor: EMERALD_LIGHT, borderTop: `1 solid ${EMERALD}`, borderRadius: 4 },
  grandLabel: { fontSize: 11, fontWeight: 700, color: EMERALD_DARK },
  grandValue: { fontSize: 11, fontWeight: 700, color: EMERALD },
  subLabel: { fontSize: 9, color: GRAY_700 },
  subValue: { fontSize: 9, fontWeight: 700, color: GRAY_900 },

  notes: { marginTop: 16, padding: '8 10', backgroundColor: GRAY_50, borderRadius: 5 },
  notesLabel: { fontSize: 7.5, color: GRAY_500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  notesText: { fontSize: 8, color: GRAY_700 },

  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, paddingTop: 7, borderTop: `0.5 solid ${GRAY_200}`, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: GRAY_500 },
})

const typeLabel = (l: InvoiceLineItem) => l.label

export interface InvoicePdfLabels {
  invoice: string
  number: string
  issueDate: string
  period: string
  billTo: string
  remitTo: string
  employee: string
  description: string
  qty: string
  rate: string
  amount: string
  subtotal: string
  total: string
  notes: string
  draftWatermark: string
  generated: string
}

export function InvoiceDocument({
  invoice,
  client,
  company,
  labels,
}: {
  invoice: Invoice
  client: BillingClient
  company: CompanySettings
  labels: InvoicePdfLabels
}) {
  const country = invoice.currencyCountry
  const money = (n: number) => formatMoneyPdf(n, country)
  const number = invoice.number || labels.draftWatermark

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View style={S.logoWrap}>
            {company.logoBase64 ? <Image style={S.logo} src={company.logoBase64} /> : null}
            <View>
              <Text style={S.companyName}>{company.name}</Text>
              {company.rnc ? <Text style={S.companyMeta}>RNC: {company.rnc}</Text> : null}
              {company.address ? <Text style={S.companyMeta}>{company.address}</Text> : null}
              {company.phone ? <Text style={S.companyMeta}>{company.phone}</Text> : null}
              {company.email ? <Text style={S.companyMeta}>{company.email}</Text> : null}
            </View>
          </View>
          <View style={S.headerRight}>
            <Text style={S.invoiceTitle}>{labels.invoice.toUpperCase()}</Text>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>{labels.number}:</Text>
              <Text style={S.metaValue}>{number}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>{labels.issueDate}:</Text>
              <Text style={S.metaValue}>{invoice.issueDate}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>{labels.period}:</Text>
              <Text style={S.metaValue}>{invoice.periodStart} – {invoice.periodEnd}</Text>
            </View>
          </View>
        </View>

        {/* Parties */}
        <View style={S.partiesRow}>
          <View style={S.partyBox}>
            <Text style={S.partyLabel}>{labels.billTo}</Text>
            <Text style={S.partyName}>{client.name}</Text>
            {client.contactName ? <Text style={S.partyLine}>{client.contactName}</Text> : null}
            {client.billingAddress ? <Text style={S.partyLine}>{client.billingAddress}</Text> : null}
            {client.contactEmail ? <Text style={S.partyLine}>{client.contactEmail}</Text> : null}
            {client.contactPhone ? <Text style={S.partyLine}>{client.contactPhone}</Text> : null}
          </View>
          {(client.remitToName || client.remitToAddress || client.remitToDetails) ? (
            <View style={S.partyBox}>
              <Text style={S.partyLabel}>{labels.remitTo}</Text>
              {client.remitToName ? <Text style={S.partyName}>{client.remitToName}</Text> : null}
              {client.remitToAddress ? <Text style={S.partyLine}>{client.remitToAddress}</Text> : null}
              {client.remitToDetails ? <Text style={S.partyLine}>{client.remitToDetails}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* Line items */}
        <View>
          <View style={S.tHead}>
            <Text style={[S.th, S.colEmp]}>{labels.employee}</Text>
            <Text style={[S.th, S.colDesc]}>{labels.description}</Text>
            <Text style={[S.th, S.colQty]}>{labels.qty}</Text>
            <Text style={[S.th, S.colRate]}>{labels.rate}</Text>
            <Text style={[S.th, S.colAmt]}>{labels.amount}</Text>
          </View>
          {invoice.lineItems.map((l, i) => (
            <View key={l.id} style={i % 2 === 1 ? [S.tRow, S.tRowAlt] : S.tRow} wrap={false}>
              <View style={S.colEmp}>
                <Text style={S.tdBold}>{l.employeeName}</Text>
                {l.title ? <Text style={[S.td, { fontSize: 7, color: GRAY_500 }]}>{l.title}</Text> : null}
              </View>
              <Text style={[S.td, S.colDesc]}>{typeLabel(l)}</Text>
              <Text style={[S.td, S.colQty]}>{l.type === 'base' || l.type === 'overtime' ? formatHours(l.quantity) : formatHours(l.quantity)}</Text>
              <Text style={[S.td, S.colRate]}>{l.type === 'percentage' ? '—' : money(l.rate)}</Text>
              <Text style={[S.tdBold, S.colAmt]}>{money(l.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={S.totalRow}>
          <View style={S.totalBox}>
            <View style={S.totalLine}>
              <Text style={S.subLabel}>{labels.subtotal}</Text>
              <Text style={S.subValue}>{money(invoice.subtotal)}</Text>
            </View>
            <View style={S.grandLine}>
              <Text style={S.grandLabel}>{labels.total}</Text>
              <Text style={S.grandValue}>{money(invoice.total)}</Text>
            </View>
          </View>
        </View>

        {invoice.notes ? (
          <View style={S.notes}>
            <Text style={S.notesLabel}>{labels.notes}</Text>
            <Text style={S.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        <View style={S.footer} fixed>
          <Text style={S.footerText}>{company.name}</Text>
          <Text style={S.footerText}>{labels.generated}</Text>
        </View>
      </Page>
    </Document>
  )
}
