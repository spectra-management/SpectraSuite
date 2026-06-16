import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { PayrollEntry, CompanySettings } from '@/types'
import { roundHalfUp } from '@/lib/payroll/calculations'

Font.register({
  family: 'Inter',
  src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
})

const EMERALD = '#059669'
const EMERALD_DARK = '#065F46'
const EMERALD_LIGHT = '#ECFDF5'
const GRAY_50 = '#F9FAFB'
const GRAY_100 = '#F3F4F6'
const GRAY_200 = '#E5E7EB'
const GRAY_500 = '#6B7280'
const GRAY_700 = '#374151'
const GRAY_900 = '#111827'
const RED = '#EF4444'

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 32, backgroundColor: '#FFFFFF', color: GRAY_900 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 14, borderBottom: `1 solid ${GRAY_200}` },
  headerLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  logo: { width: 44, height: 44, borderRadius: 6, objectFit: 'contain' },
  companyName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: EMERALD },
  companyInfo: { fontSize: 7.5, color: GRAY_500, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  stubTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: GRAY_900, letterSpacing: 1 },
  periodRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  periodLabel: { fontSize: 7.5, color: GRAY_500 },
  periodValue: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: GRAY_700 },

  // Employee box
  employeeBox: { backgroundColor: GRAY_50, borderRadius: 6, padding: 10, marginBottom: 14, borderLeft: `3 solid ${EMERALD}` },
  empName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: GRAY_900, marginBottom: 4 },
  empMetaRow: { flexDirection: 'row', gap: 16 },
  empMeta: { fontSize: 7.5, color: GRAY_500 },
  empMetaBold: { fontFamily: 'Helvetica-Bold', color: GRAY_700 },

  // Section
  section: { marginBottom: 12 },

  // Earnings table
  tableHeader: { flexDirection: 'row', backgroundColor: EMERALD, padding: '5 8', borderRadius: '4 4 0 0' },
  tableHeaderText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', flex: 3 },
  tableHeaderRight: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', flex: 1, textAlign: 'right' },

  tableSubHeader: { flexDirection: 'row', backgroundColor: GRAY_100, padding: '4 8', borderBottom: `1 solid ${GRAY_200}` },
  tableSubHeaderText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: GRAY_500, textTransform: 'uppercase', flex: 3 },
  tableSubHeaderRight: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: GRAY_500, textTransform: 'uppercase', flex: 1, textAlign: 'right' },

  tableRow: { flexDirection: 'row', padding: '4 8', borderBottom: `1 solid ${GRAY_100}` },
  tableCell: { fontSize: 8, color: GRAY_700, flex: 3 },
  tableCellRight: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRAY_900, flex: 1, textAlign: 'right' },

  grossRow: { flexDirection: 'row', padding: '6 8', backgroundColor: GRAY_50, borderTop: `1 solid ${GRAY_200}` },
  grossLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: GRAY_900, flex: 3 },
  grossValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: EMERALD, flex: 1, textAlign: 'right' },

  // Deductions table
  dedHeader: { flexDirection: 'row', backgroundColor: GRAY_700, padding: '5 8', borderRadius: '4 4 0 0' },
  dedHeaderText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', flex: 3 },
  dedHeaderRight: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', flex: 1, textAlign: 'right' },

  dedRow: { flexDirection: 'row', padding: '4 8', borderBottom: `1 solid ${GRAY_100}` },
  dedLabel: { fontSize: 8, color: GRAY_700, flex: 3 },
  dedRate: { fontSize: 8, color: GRAY_500, flex: 1, textAlign: 'center' },
  dedAmount: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: RED, flex: 1, textAlign: 'right' },
  dedAmountNeutral: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRAY_700, flex: 1, textAlign: 'right' },

  totalDedRow: { flexDirection: 'row', padding: '6 8', backgroundColor: GRAY_50, borderTop: `1 solid ${GRAY_200}` },
  totalDedLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: GRAY_900, flex: 3 },
  totalDedValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: RED, flex: 1, textAlign: 'right' },

  // Net pay
  netBox: { backgroundColor: EMERALD_LIGHT, borderRadius: 6, padding: '10 12', marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', border: `1 solid ${EMERALD}` },
  netLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: EMERALD_DARK },
  netValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: EMERALD },

  // Footer
  footer: { marginTop: 20, paddingTop: 8, borderTop: `1 solid ${GRAY_100}`, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: GRAY_500 },
})

function fmt(n: number): string {
  return `RD$ ${roundHalfUp(n, 2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface Props {
  entry: PayrollEntry
  company: CompanySettings
  startDate: string
  endDate: string
  lang: 'en' | 'es'
  otRatePercent?: number
  holidayRatePercent?: number
}

const labels = {
  en: {
    payStub: 'PAYSTUB',
    dateRange: 'Date Range',
    payDate: 'Pay Date',
    position: 'Position',
    department: 'Department',
    employeeId: 'ID',
    earnings: 'EARNINGS',
    concept: 'Concept',
    hours: 'Hours',
    rate: 'Rate',
    amount: 'Amount',
    regular: 'Regular Hours',
    ot: 'Overtime Hours',
    holiday: 'Double Holiday Hours',
    grossTotal: 'GROSS TOTAL',
    deductions: 'DEDUCTIONS',
    rateCol: 'Rate',
    sfs: 'Family Health Insurance (SFS)',
    afp: 'Pension Retention (AFP)',
    isr: 'Tax Retention ISR (DGII)',
    isrSalary: 'Salary for the month applicable to ISR',
    totalDed: 'Total Deductions',
    netPay: 'NET INCOME',
    generatedOn: 'Generated on',
    rnc: 'RNC',
  },
  es: {
    payStub: 'COMPROBANTE DE PAGO',
    dateRange: 'Período',
    payDate: 'Fecha de pago',
    position: 'Cargo',
    department: 'Departamento',
    employeeId: 'ID',
    earnings: 'INGRESOS',
    concept: 'Concepto',
    hours: 'Horas',
    rate: 'Tarifa',
    amount: 'Monto',
    regular: 'Horas Regulares',
    ot: 'Horas Extra',
    holiday: 'Horas Feriado Doble',
    grossTotal: 'TOTAL BRUTO',
    deductions: 'DEDUCCIONES',
    rateCol: 'Tasa',
    sfs: 'Seguro Familiar de Salud (SFS)',
    afp: 'Retención Pensión (AFP)',
    isr: 'Retención ISR (DGII)',
    isrSalary: 'Salario del mes aplicable a ISR',
    totalDed: 'Total Deducciones',
    netPay: 'SALARIO NETO',
    generatedOn: 'Generado el',
    rnc: 'RNC',
  },
}

export function PayStubDocument({
  entry,
  company,
  startDate,
  endDate,
  lang,
  otRatePercent = 35,
  holidayRatePercent = 100,
}: Props) {
  const { employee: emp, calculation: c, hours: h } = entry
  const l = labels[lang]
  const today = new Date().toLocaleDateString(lang === 'es' ? 'es-DO' : 'en-US')

  const otMultiplier = 1 + otRatePercent / 100
  const holidayMultiplier = 1 + holidayRatePercent / 100
  const otMultiplierLabel = otMultiplier.toFixed(2)
  const holidayMultiplierLabel = holidayMultiplier.toFixed(2)

  // Monthly salary basis for ISR (annualized / 12)
  const isrMonthlySalary = roundHalfUp(c.taxableIncome / 12)

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── HEADER ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {company.logoBase64 && (
              <Image style={styles.logo} src={`data:image/png;base64,${company.logoBase64}`} />
            )}
            <View>
              <Text style={styles.companyName}>{company.name}</Text>
              {company.rnc && (
                <Text style={styles.companyInfo}>{l.rnc}: {company.rnc}</Text>
              )}
              {company.address && (
                <Text style={styles.companyInfo}>{company.address}</Text>
              )}
              {company.phone && (
                <Text style={styles.companyInfo}>{company.phone}</Text>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.stubTitle}>{l.payStub}</Text>
            <View style={styles.periodRow}>
              <Text style={styles.periodLabel}>{l.dateRange}:</Text>
              <Text style={styles.periodValue}>{startDate} – {endDate}</Text>
            </View>
            <View style={styles.periodRow}>
              <Text style={styles.periodLabel}>{l.payDate}:</Text>
              <Text style={styles.periodValue}>{today}</Text>
            </View>
          </View>
        </View>

        {/* ── EMPLOYEE ── */}
        <View style={styles.employeeBox}>
          <Text style={styles.empName}>{emp.firstName} {emp.lastName}</Text>
          <View style={styles.empMetaRow}>
            {emp.jobTitle && (
              <Text style={styles.empMeta}>
                {l.position}: <Text style={styles.empMetaBold}>{emp.jobTitle}</Text>
              </Text>
            )}
            {emp.department && (
              <Text style={styles.empMeta}>
                {l.department}: <Text style={styles.empMetaBold}>{emp.department}</Text>
              </Text>
            )}
            <Text style={styles.empMeta}>
              {l.employeeId}: <Text style={styles.empMetaBold}>{emp.id}</Text>
            </Text>
          </View>
        </View>

        {/* ── EARNINGS ── */}
        <View style={styles.section}>
          <View style={styles.tableHeader}>
            <Text style={{ ...styles.tableHeaderText, flex: 4 }}>{l.earnings}</Text>
            <Text style={styles.tableHeaderRight}>{l.hours}</Text>
            <Text style={{ ...styles.tableHeaderRight, flex: 2 }}>{l.rate}</Text>
            <Text style={styles.tableHeaderRight}>{l.amount}</Text>
          </View>

          {h.regularHours > 0 && (
            <View style={styles.tableRow}>
              <Text style={{ ...styles.tableCell, flex: 4 }}>{l.regular}</Text>
              <Text style={{ ...styles.tableCellRight, fontFamily: 'Helvetica' }}>{h.regularHours}</Text>
              <Text style={{ ...styles.tableCellRight, flex: 2, fontFamily: 'Helvetica' }}>{fmt(emp.payRate)}/hr</Text>
              <Text style={styles.tableCellRight}>{fmt(c.regularPay)}</Text>
            </View>
          )}

          {h.otHours > 0 && (
            <View style={styles.tableRow}>
              <Text style={{ ...styles.tableCell, flex: 4 }}>{l.ot}</Text>
              <Text style={{ ...styles.tableCellRight, fontFamily: 'Helvetica' }}>{h.otHours}</Text>
              <Text style={{ ...styles.tableCellRight, flex: 2, fontFamily: 'Helvetica' }}>{fmt(emp.payRate)}/hr × {otMultiplierLabel}</Text>
              <Text style={styles.tableCellRight}>{fmt(c.otPay)}</Text>
            </View>
          )}

          {h.holidayHours > 0 && (
            <View style={styles.tableRow}>
              <Text style={{ ...styles.tableCell, flex: 4 }}>{l.holiday}</Text>
              <Text style={{ ...styles.tableCellRight, fontFamily: 'Helvetica' }}>{h.holidayHours}</Text>
              <Text style={{ ...styles.tableCellRight, flex: 2, fontFamily: 'Helvetica' }}>{fmt(emp.payRate)}/hr × {holidayMultiplierLabel}</Text>
              <Text style={styles.tableCellRight}>{fmt(c.holidayPay)}</Text>
            </View>
          )}

          <View style={styles.grossRow}>
            <Text style={{ ...styles.grossLabel, flex: 4 }}>{l.grossTotal}</Text>
            <Text style={{ ...styles.grossLabel, flex: 1 }}> </Text>
            <Text style={{ ...styles.grossLabel, flex: 2 }}> </Text>
            <Text style={styles.grossValue}>{fmt(c.grossPay)}</Text>
          </View>
        </View>

        {/* ── DEDUCTIONS ── */}
        <View style={styles.section}>
          <View style={styles.dedHeader}>
            <Text style={{ ...styles.dedHeaderText, flex: 4 }}>{l.deductions}</Text>
            <Text style={{ ...styles.dedHeaderRight, flex: 1 }}>{l.rateCol}</Text>
            <Text style={{ ...styles.dedHeaderRight, flex: 2 }}>{l.amount}</Text>
          </View>

          <View style={styles.dedRow}>
            <Text style={{ ...styles.dedLabel, flex: 4 }}>{l.sfs}</Text>
            <Text style={{ ...styles.dedRate, flex: 1 }}>3.04%</Text>
            <Text style={{ ...styles.dedAmount, flex: 2 }}>({fmt(c.sfsAmount)})</Text>
          </View>

          <View style={styles.dedRow}>
            <Text style={{ ...styles.dedLabel, flex: 4 }}>{l.afp}</Text>
            <Text style={{ ...styles.dedRate, flex: 1 }}>2.87%</Text>
            <Text style={{ ...styles.dedAmount, flex: 2 }}>({fmt(c.afpAmount)})</Text>
          </View>

          {c.customDeductionsBreakdown.map((d) => (
            <View key={d.name} style={styles.dedRow}>
              <Text style={{ ...styles.dedLabel, flex: 4 }}>{d.name}</Text>
              <Text style={{ ...styles.dedRate, flex: 1 }}> </Text>
              <Text style={{ ...styles.dedAmount, flex: 2 }}>({fmt(d.amount)})</Text>
            </View>
          ))}

          <View style={styles.dedRow}>
            <Text style={{ ...styles.dedLabel, flex: 4 }}>{l.isr}</Text>
            <Text style={{ ...styles.dedRate, flex: 1 }}> </Text>
            <Text style={{ ...styles.dedAmount, flex: 2 }}>({fmt(c.isrPeriod)})</Text>
          </View>

          <View style={styles.dedRow}>
            <Text style={{ ...styles.dedLabel, flex: 4 }}>{l.isrSalary}</Text>
            <Text style={{ ...styles.dedRate, flex: 1 }}> </Text>
            <Text style={{ ...styles.dedAmountNeutral, flex: 2 }}>{fmt(isrMonthlySalary)}</Text>
          </View>

          <View style={styles.totalDedRow}>
            <Text style={{ ...styles.totalDedLabel, flex: 4 }}>{l.totalDed}</Text>
            <Text style={{ ...styles.totalDedLabel, flex: 1 }}> </Text>
            <Text style={{ ...styles.totalDedValue, flex: 2 }}>({fmt(c.totalDeductions)})</Text>
          </View>
        </View>

        {/* ── NET INCOME ── */}
        <View style={styles.netBox}>
          <Text style={styles.netLabel}>{l.netPay}</Text>
          <Text style={styles.netValue}>{fmt(c.netPay)}</Text>
        </View>

        {/* ── FOOTER ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {company.name}{company.rnc ? ` — ${l.rnc} ${company.rnc}` : ''}
          </Text>
          <Text style={styles.footerText}>{l.generatedOn} {today}</Text>
        </View>

      </Page>
    </Document>
  )
}
