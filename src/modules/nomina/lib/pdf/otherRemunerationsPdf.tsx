import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import type { CompanySettings } from '@/shared/types'
import { roundHalfUp, safeNum } from '@/modules/nomina/lib/payroll/calculations'
import { logoSrc } from './logo'

const EMERALD = '#059669'
const EMERALD_LIGHT = '#ECFDF5'
const GRAY_50 = '#F9FAFB'
const GRAY_100 = '#F3F4F6'
const GRAY_200 = '#E5E7EB'
const GRAY_500 = '#6B7280'
const GRAY_700 = '#374151'
const GRAY_900 = '#111827'

const S = StyleSheet.create({
  page: { fontFamily: 'Roboto', fontSize: 8, padding: '28 32', backgroundColor: '#FFFFFF', color: GRAY_900 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 12, borderBottom: `1.5 solid ${EMERALD}` },
  logoWrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  logo: { width: 40, height: 40, borderRadius: 5, objectFit: 'contain' },
  companyName: { fontSize: 13, fontFamily: 'Roboto', fontWeight: 700, color: EMERALD, marginBottom: 2 },
  companyMeta: { fontSize: 7, color: GRAY_500, marginTop: 1 },
  headerRight: { alignItems: 'flex-end' },
  reportTitle: { fontSize: 14, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900, letterSpacing: 1, marginBottom: 4 },
  metaRow: { flexDirection: 'row', gap: 6, marginTop: 2 },
  metaLabel: { fontSize: 7.5, color: GRAY_500 },
  metaValue: { fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_700 },

  note: { fontSize: 7, color: GRAY_500, marginBottom: 10 },

  tHead: { flexDirection: 'row', backgroundColor: EMERALD, padding: '4 6', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  tHeadText: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: '#FFFFFF', textAlign: 'right' },
  tHeadLeft: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: '#FFFFFF' },
  tRow: { flexDirection: 'row', padding: '3.5 6', borderBottom: `0.5 solid ${GRAY_100}` },
  tRowAlt: { flexDirection: 'row', padding: '3.5 6', borderBottom: `0.5 solid ${GRAY_100}`, backgroundColor: GRAY_50 },
  tCell: { fontSize: 7, color: GRAY_700, textAlign: 'right' },
  tCellLeft: { fontSize: 7, color: GRAY_700 },
  tCellBoldLeft: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900 },
  tCellGreen: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: EMERALD, textAlign: 'right' },
  tTotal: { flexDirection: 'row', padding: '4.5 6', borderTop: `1.5 solid ${GRAY_200}`, backgroundColor: GRAY_100 },
  tTotalLabel: { fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900 },
  tTotalValue: { fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900, textAlign: 'right' },
  tTotalGreen: { fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, color: EMERALD, textAlign: 'right' },

  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: GRAY_50, borderRadius: 5, padding: '8 10', borderLeft: `3 solid ${GRAY_200}` },
  summaryCardEmph: { flex: 1, backgroundColor: EMERALD_LIGHT, borderRadius: 5, padding: '8 10', borderLeft: `3 solid ${EMERALD}` },
  summaryLabel: { fontSize: 7, color: GRAY_500, marginBottom: 3 },
  summaryValue: { fontSize: 11, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900 },
  summaryValueEmph: { fontSize: 11, fontFamily: 'Roboto', fontWeight: 700, color: EMERALD },

  footer: { marginTop: 20, paddingTop: 10, borderTop: `1 solid ${GRAY_200}` },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  signBox: { flex: 1, borderTop: `1 solid ${GRAY_700}`, paddingTop: 5, marginRight: 40 },
  signLabel: { fontSize: 7.5, color: GRAY_500 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: GRAY_500 },
})

const RL = {
  en: {
    title: 'OTHER REMUNERATIONS REPORT',
    period: 'Period',
    generated: 'Generated',
    rnc: 'RNC',
    note: 'Overtime and holiday premiums paid in the month (non-contributory extra pay, the complement of the TSS contributory salary).',
    cedula: 'ID (Cédula)',
    name: 'Full Name',
    otHours: 'OT Hours',
    otPay: 'Overtime',
    holidayHours: 'Holiday Hrs',
    holidayPay: 'Holidays',
    total: 'Total',
    totals: 'TOTALS',
    employees: 'Employees',
    totalOt: 'Total Overtime',
    totalHoliday: 'Total Holidays',
    grandTotal: 'Total Other Remunerations',
    preparedBy: 'Prepared by',
    approvedBy: 'Approved by',
  },
  es: {
    title: 'REPORTE DE OTRAS REMUNERACIONES',
    period: 'Período',
    generated: 'Generado',
    rnc: 'RNC',
    note: 'Recargos de horas extras y feriados pagados en el mes (pago extra no cotizable, el complemento del salario cotizable TSS).',
    cedula: 'Cédula',
    name: 'Nombre Completo',
    otHours: 'Hrs Extras',
    otPay: 'Horas Extras',
    holidayHours: 'Hrs Feriado',
    holidayPay: 'Feriados',
    total: 'Total',
    totals: 'TOTALES',
    employees: 'Empleados',
    totalOt: 'Total Horas Extras',
    totalHoliday: 'Total Feriados',
    grandTotal: 'Total Otras Remuneraciones',
    preparedBy: 'Preparado por',
    approvedBy: 'Aprobado por',
  },
} as const

export interface OtherRemunerationsRow {
  employeeId: string
  cedula: string
  fullName: string
  otHours: number
  /** OT premium paid in the month. */
  otPay: number
  holidayHours: number
  /** Holiday premium paid in the month. */
  holidayPay: number
}

export interface OtherRemunerationsProps {
  /** e.g. "Junio 2026" / "June 2026" — already localized by the caller. */
  periodLabel: string
  rows: OtherRemunerationsRow[]
  company: CompanySettings
  lang: 'en' | 'es'
  /** Currency symbol for the amounts (RD$ for DR). */
  currencySymbol: string
}

export function OtherRemunerationsDocument({ periodLabel, rows, company, lang, currencySymbol }: OtherRemunerationsProps) {
  const l = RL[lang]
  const logo = logoSrc(company.logoBase64)
  const today = new Date().toLocaleDateString(lang === 'es' ? 'es-DO' : 'en-US')
  const fmt = (n: number) =>
    `${currencySymbol} ${roundHalfUp(safeNum(n), 2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const totOtHours = roundHalfUp(rows.reduce((s, r) => s + r.otHours, 0))
  const totOtPay = roundHalfUp(rows.reduce((s, r) => s + r.otPay, 0))
  const totHolHours = roundHalfUp(rows.reduce((s, r) => s + r.holidayHours, 0))
  const totHolPay = roundHalfUp(rows.reduce((s, r) => s + r.holidayPay, 0))
  const grandTotal = roundHalfUp(totOtPay + totHolPay)

  // Column flex widths: [cedula 2, name 3.6, otHrs 1.2, ot 1.9, holHrs 1.2, hol 1.9, total 1.9]
  const cCed = 2, cName = 3.6, cOtH = 1.2, cOt = 1.9, cHolH = 1.2, cHol = 1.9, cTot = 1.9

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <View style={S.logoWrap}>
            {logo && <Image style={S.logo} src={logo} />}
            <View>
              <Text style={S.companyName}>{company.name}</Text>
              {!!company.rnc && <Text style={S.companyMeta}>{l.rnc}: {company.rnc}</Text>}
              {!!company.address && <Text style={S.companyMeta}>{company.address}</Text>}
            </View>
          </View>
          <View style={S.headerRight}>
            <Text style={S.reportTitle}>{l.title}</Text>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>{l.period}:</Text>
              <Text style={S.metaValue}>{periodLabel}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>{l.generated}:</Text>
              <Text style={S.metaValue}>{today}</Text>
            </View>
          </View>
        </View>

        {/* Summary cards */}
        <View style={S.summaryRow}>
          <View style={S.summaryCard}>
            <Text style={S.summaryLabel}>{l.employees}</Text>
            <Text style={S.summaryValue}>{rows.length}</Text>
          </View>
          <View style={S.summaryCard}>
            <Text style={S.summaryLabel}>{l.totalOt}</Text>
            <Text style={S.summaryValue}>{fmt(totOtPay)}</Text>
          </View>
          <View style={S.summaryCard}>
            <Text style={S.summaryLabel}>{l.totalHoliday}</Text>
            <Text style={S.summaryValue}>{fmt(totHolPay)}</Text>
          </View>
          <View style={S.summaryCardEmph}>
            <Text style={S.summaryLabel}>{l.grandTotal}</Text>
            <Text style={S.summaryValueEmph}>{fmt(grandTotal)}</Text>
          </View>
        </View>

        <Text style={S.note}>{l.note}</Text>

        {/* Table */}
        <View style={S.tHead}>
          <Text style={[S.tHeadLeft, { flex: cCed }]}>{l.cedula}</Text>
          <Text style={[S.tHeadLeft, { flex: cName }]}>{l.name}</Text>
          <Text style={[S.tHeadText, { flex: cOtH }]}>{l.otHours}</Text>
          <Text style={[S.tHeadText, { flex: cOt }]}>{l.otPay}</Text>
          <Text style={[S.tHeadText, { flex: cHolH }]}>{l.holidayHours}</Text>
          <Text style={[S.tHeadText, { flex: cHol }]}>{l.holidayPay}</Text>
          <Text style={[S.tHeadText, { flex: cTot }]}>{l.total}</Text>
        </View>
        {rows.map((r, i) => (
          <View key={r.employeeId} style={i % 2 === 0 ? S.tRow : S.tRowAlt} wrap={false}>
            <Text style={[S.tCellLeft, { flex: cCed }]}>{r.cedula || '—'}</Text>
            <Text style={[S.tCellBoldLeft, { flex: cName }]}>{r.fullName}</Text>
            <Text style={[S.tCell, { flex: cOtH }]}>{r.otHours}</Text>
            <Text style={[S.tCell, { flex: cOt }]}>{fmt(r.otPay)}</Text>
            <Text style={[S.tCell, { flex: cHolH }]}>{r.holidayHours}</Text>
            <Text style={[S.tCell, { flex: cHol }]}>{fmt(r.holidayPay)}</Text>
            <Text style={[S.tCellGreen, { flex: cTot }]}>{fmt(roundHalfUp(r.otPay + r.holidayPay))}</Text>
          </View>
        ))}
        <View style={S.tTotal}>
          <Text style={[S.tTotalLabel, { flex: cCed }]}>{l.totals}</Text>
          <Text style={[S.tTotalLabel, { flex: cName }]}> </Text>
          <Text style={[S.tTotalValue, { flex: cOtH }]}>{totOtHours}</Text>
          <Text style={[S.tTotalValue, { flex: cOt }]}>{fmt(totOtPay)}</Text>
          <Text style={[S.tTotalValue, { flex: cHolH }]}>{totHolHours}</Text>
          <Text style={[S.tTotalValue, { flex: cHol }]}>{fmt(totHolPay)}</Text>
          <Text style={[S.tTotalGreen, { flex: cTot }]}>{fmt(grandTotal)}</Text>
        </View>

        {/* Footer */}
        <View style={S.footer}>
          <View style={S.signRow}>
            <View style={S.signBox}>
              <Text style={S.signLabel}>{l.preparedBy}</Text>
            </View>
            <View style={S.signBox}>
              <Text style={S.signLabel}>{l.approvedBy}</Text>
            </View>
          </View>
          <View style={S.footerRow}>
            <Text style={S.footerText}>{company.name}{company.rnc ? ` — ${l.rnc} ${company.rnc}` : ''}</Text>
            <Text style={S.footerText}>{l.generated} {today}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
