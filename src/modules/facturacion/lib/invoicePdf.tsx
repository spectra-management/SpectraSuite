import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer'
import type { CompanySettings } from '@/shared/types'
import type { BillingClient, Invoice } from './types'
import { formatMoneyPdf, formatHours } from './format'
import { toInvoiceRows, toEmployeeHours } from './invoiceView'

const EMERALD = '#059669'
const EMERALD_DARK = '#065F46'
const GRAY_100 = '#F3F4F6'
const GRAY_200 = '#E5E7EB'
const GRAY_300 = '#D1D5DB'
const GRAY_500 = '#6B7280'
const GRAY_700 = '#374151'
const GRAY_900 = '#111827'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function dparts(iso: string): { y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? { y: +m[1], mo: +m[2], d: +m[3] } : null
}
/** MM/DD/YY */
function shortDate(iso: string): string {
  const p = dparts(iso)
  if (!p) return iso || ''
  return `${String(p.mo).padStart(2, '0')}/${String(p.d).padStart(2, '0')}/${String(p.y).slice(2)}`
}
/** e.g. "Feb 1 – Feb 15, 2026" (or across months/years). */
function humanPeriod(a: string, b: string): string {
  const s = dparts(a), e = dparts(b)
  if (!s || !e) return `${a} – ${b}`
  const left = `${MONTHS[s.mo - 1]} ${s.d}${s.y !== e.y ? `, ${s.y}` : ''}`
  const right = `${MONTHS[e.mo - 1]} ${e.d}, ${e.y}`
  return `${left} – ${right}`
}

const S = StyleSheet.create({
  page: { fontSize: 9, padding: '36 40 56 40', backgroundColor: '#FFFFFF', color: GRAY_900 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  logoWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  logo: { width: 46, height: 46, borderRadius: 5, objectFit: 'contain' },
  companyName: { fontSize: 14, fontWeight: 700, color: EMERALD, marginBottom: 2 },
  companyMeta: { fontSize: 7.5, color: GRAY_500, marginTop: 1 },
  headerRight: { alignItems: 'flex-end' },
  invoiceTitle: { fontSize: 20, fontWeight: 700, color: GRAY_900, letterSpacing: 2, marginBottom: 6 },
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 2, justifyContent: 'flex-end' },
  metaLabel: { fontSize: 8, color: GRAY_500 },
  metaValue: { fontSize: 8, fontWeight: 700, color: GRAY_700 },

  billTo: { marginTop: 14, marginBottom: 8 },
  billToLabel: { fontSize: 7.5, color: GRAY_500, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  billToName: { fontSize: 9.5, fontWeight: 700, color: GRAY_900 },
  billToLine: { fontSize: 8.5, color: GRAY_700, marginTop: 1 },

  divider: { height: 3, backgroundColor: GRAY_300, borderRadius: 2, marginTop: 8, marginBottom: 8 },

  tHead: { flexDirection: 'row', backgroundColor: GRAY_200, padding: '5 6', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  th: { fontSize: 7.5, fontWeight: 700, color: GRAY_700 },
  tRow: { flexDirection: 'row', padding: '4 6', borderBottom: `0.5 solid ${GRAY_100}` },
  td: { fontSize: 8, color: GRAY_700 },
  tdBold: { fontSize: 8, fontWeight: 700, color: GRAY_900 },
  totalsRow: { flexDirection: 'row', padding: '5 6', backgroundColor: GRAY_100, borderTop: `1 solid ${GRAY_300}` },
  invoiceTotalRow: { flexDirection: 'row', padding: '6 6', backgroundColor: GRAY_200, marginTop: 3, borderRadius: 3 },

  // Invoice table columns
  cDate: { width: '11%' },
  cPeriod: { width: '20%' },
  cDesc: { width: '22%' },
  cClass: { width: '17%' },
  cHours: { width: '10%', textAlign: 'right' },
  cRate: { width: '10%', textAlign: 'right' },
  cTotal: { width: '10%', textAlign: 'right' },

  remit: { marginTop: 22 },
  remitLabel: { fontSize: 8.5, fontWeight: 700, color: GRAY_900, marginBottom: 2 },
  remitLine: { fontSize: 8.5, color: GRAY_700, marginTop: 1 },

  sectionTitle: { fontSize: 12, fontWeight: 700, color: GRAY_900, marginBottom: 8 },
  // Hours appendix columns
  hName: { width: '46%' },
  hCol: { width: '18%', textAlign: 'right' },

  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, paddingTop: 7, borderTop: `0.5 solid ${GRAY_200}`, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: GRAY_500 },
})

export interface InvoicePdfLabels {
  invoice: string
  number: string
  issueDate: string
  period: string
  billTo: string
  date: string
  description: string
  payClass: string
  totalHours: string
  hourlyRate: string
  total: string
  totals: string
  invoiceTotal: string
  remitIntro: string
  draftWatermark: string
  generated: string
  hoursDetailTitle: string
  employee: string
  worked: string
  baseHours: string
  overtimeHours: string
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
  const rows = toInvoiceRows(invoice.lineItems)
  const empHours = toEmployeeHours(invoice.lineItems)
  const period = humanPeriod(invoice.periodStart, invoice.periodEnd)
  const dateStr = shortDate(invoice.issueDate)

  const Footer = () => (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>{company.name}</Text>
      <Text style={S.footerText}>{labels.generated}</Text>
    </View>
  )

  return (
    <Document>
      {/* ── INVOICE ── */}
      <Page size="LETTER" style={S.page}>
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
              <Text style={S.metaLabel}>{labels.issueDate}:</Text>
              <Text style={S.metaValue}>{shortDate(invoice.issueDate)}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>{labels.number}:</Text>
              <Text style={S.metaValue}>{number}</Text>
            </View>
          </View>
        </View>

        {/* Bill-to (client) */}
        <View style={S.billTo}>
          <Text style={S.billToLabel}>{labels.billTo}</Text>
          {client.contactName ? <Text style={S.billToLine}>{client.contactName}</Text> : null}
          <Text style={S.billToName}>{client.name}</Text>
          {client.billingAddress
            ? client.billingAddress.split('\n').map((ln, i) => <Text key={i} style={S.billToLine}>{ln}</Text>)
            : null}
        </View>

        <View style={S.divider} />

        {/* Line items */}
        <View>
          <View style={S.tHead}>
            <Text style={[S.th, S.cDate]}>{labels.date}</Text>
            <Text style={[S.th, S.cPeriod]}>{labels.period}</Text>
            <Text style={[S.th, S.cDesc]}>{labels.description}</Text>
            <Text style={[S.th, S.cClass]}>{labels.payClass}</Text>
            <Text style={[S.th, S.cHours]}>{labels.totalHours}</Text>
            <Text style={[S.th, S.cRate]}>{labels.hourlyRate}</Text>
            <Text style={[S.th, S.cTotal]}>{labels.total}</Text>
          </View>
          {rows.map((r, i) => {
            const isHours = r.hours !== null
            return (
              <View key={i} style={S.tRow} wrap={false}>
                <Text style={[S.td, S.cDate]}>{isHours ? dateStr : ''}</Text>
                <Text style={[S.td, S.cPeriod]}>{isHours ? period : ''}</Text>
                <Text style={[S.tdBold, S.cDesc]}>{r.description}</Text>
                <Text style={[S.td, S.cClass]}>{r.payClass}</Text>
                <Text style={[S.td, S.cHours]}>{isHours ? formatHours(r.hours as number) : (r.quantity ?? '')}</Text>
                <Text style={[S.td, S.cRate]}>{r.rate === null ? '—' : money(r.rate)}</Text>
                <Text style={[S.tdBold, S.cTotal]}>{money(r.amount)}</Text>
              </View>
            )
          })}

          {/* Totals */}
          <View style={S.totalsRow}>
            <Text style={[S.tdBold, { width: '80%' }]}>{labels.totals}</Text>
            <Text style={[S.tdBold, { width: '20%', textAlign: 'right' }]}>{money(invoice.total)}</Text>
          </View>
          <View style={S.invoiceTotalRow}>
            <Text style={[{ width: '80%', textAlign: 'right', fontSize: 9.5, fontWeight: 700, color: EMERALD_DARK }]}>{labels.invoiceTotal}</Text>
            <Text style={[{ width: '20%', textAlign: 'right', fontSize: 9.5, fontWeight: 700, color: EMERALD }]}>{money(invoice.total)}</Text>
          </View>
        </View>

        {/* Remit-to */}
        {(client.remitToName || client.remitToAddress || client.remitToDetails) ? (
          <View style={S.remit}>
            <Text style={S.remitLabel}>{labels.remitIntro}</Text>
            {client.remitToName ? <Text style={S.remitLine}>{client.remitToName}</Text> : null}
            {client.remitToAddress
              ? client.remitToAddress.split('\n').map((ln, i) => <Text key={i} style={S.remitLine}>{ln}</Text>)
              : null}
            {client.remitToDetails
              ? client.remitToDetails.split('\n').map((ln, i) => <Text key={i} style={S.remitLine}>{ln}</Text>)
              : null}
          </View>
        ) : null}

        <Footer />
      </Page>

      {/* ── HOURS DETAIL (appendix) ── */}
      {empHours.length > 0 ? (
        <Page size="LETTER" style={S.page}>
          <Text style={S.sectionTitle}>{labels.hoursDetailTitle}</Text>
          <Text style={[S.billToLine, { marginBottom: 8 }]}>{client.name} · {period}</Text>
          <View>
            <View style={S.tHead}>
              <Text style={[S.th, S.hName]}>{labels.employee}</Text>
              <Text style={[S.th, S.hCol]}>{labels.worked}</Text>
              <Text style={[S.th, S.hCol]}>{labels.baseHours}</Text>
              <Text style={[S.th, S.hCol]}>{labels.overtimeHours}</Text>
            </View>
            {empHours.map((e, i) => (
              <View key={i} style={S.tRow} wrap={false}>
                <View style={S.hName}>
                  <Text style={S.tdBold}>{e.employeeName}</Text>
                  {e.title ? <Text style={[S.td, { fontSize: 7, color: GRAY_500 }]}>{e.title}</Text> : null}
                </View>
                <Text style={[S.td, S.hCol]}>{formatHours(e.totalWorked)}</Text>
                <Text style={[S.td, S.hCol]}>{formatHours(e.baseHours)}</Text>
                <Text style={[S.td, S.hCol]}>{formatHours(e.overtimeHours)}</Text>
              </View>
            ))}
            <View style={S.totalsRow}>
              <Text style={[S.tdBold, S.hName]}>{labels.totals}</Text>
              <Text style={[S.tdBold, S.hCol]}>{formatHours(empHours.reduce((s, e) => s + e.totalWorked, 0))}</Text>
              <Text style={[S.tdBold, S.hCol]}>{formatHours(empHours.reduce((s, e) => s + e.baseHours, 0))}</Text>
              <Text style={[S.tdBold, S.hCol]}>{formatHours(empHours.reduce((s, e) => s + e.overtimeHours, 0))}</Text>
            </View>
          </View>
          <Footer />
        </Page>
      ) : null}
    </Document>
  )
}
