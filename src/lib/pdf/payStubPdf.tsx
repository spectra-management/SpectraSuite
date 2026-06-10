import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'
import type { PayrollEntry, CompanySettings } from '@/types'
import { roundHalfUp } from '@/lib/payroll/calculations'

Font.register({
  family: 'Inter',
  src: 'https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
})

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, padding: 32, backgroundColor: '#FFFFFF', color: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1 solid #E5E7EB' },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#059669' },
  companyInfo: { fontSize: 8, color: '#6B7280', marginTop: 2 },
  title: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#111827', textAlign: 'right' },
  periodText: { fontSize: 8, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, paddingBottom: 4, borderBottom: '1 solid #F3F4F6' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  rowLabel: { color: '#374151', flex: 1 },
  rowValue: { color: '#111827', textAlign: 'right', minWidth: 80, fontFamily: 'Helvetica-Bold' },
  rowValueNeg: { color: '#EF4444', textAlign: 'right', minWidth: 80, fontFamily: 'Helvetica-Bold' },
  employeeBox: { backgroundColor: '#F9FAFB', borderRadius: 6, padding: 10, marginBottom: 14 },
  empName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#111827', marginBottom: 3 },
  empDetail: { fontSize: 8, color: '#6B7280', marginTop: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderTop: '1 solid #E5E7EB', marginTop: 3 },
  totalLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#111827' },
  totalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#059669', textAlign: 'right' },
  netBox: { backgroundColor: '#ECFDF5', borderRadius: 6, padding: 10, marginTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  netLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#065F46' },
  netValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#059669' },
  footer: { marginTop: 20, paddingTop: 10, borderTop: '1 solid #E5E7EB', flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9CA3AF' },
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
}

const labels = {
  en: {
    payStub: 'PAY STUB',
    period: 'Pay Period',
    employee: 'Employee',
    department: 'Department',
    jobTitle: 'Position',
    hireDate: 'Hire Date',
    earnings: 'EARNINGS',
    regular: 'Regular Hours',
    ot: 'Overtime Hours',
    holiday: 'Holiday Hours',
    grossPay: 'Gross Pay',
    deductions: 'DEDUCTIONS',
    afp: 'AFP (Pension 2.87%)',
    sfs: 'Health (SFS 3.04%)',
    isr: 'Income Tax (ISR)',
    otherDed: 'Other Deductions',
    totalDed: 'Total Deductions',
    netPay: 'NET PAY',
    rate: 'Rate',
    generatedOn: 'Generated on',
  },
  es: {
    payStub: 'COMPROBANTE DE PAGO',
    period: 'Período de Pago',
    employee: 'Empleado',
    department: 'Departamento',
    jobTitle: 'Cargo',
    hireDate: 'Fecha de Ingreso',
    earnings: 'INGRESOS',
    regular: 'Horas Regulares',
    ot: 'Horas Extra',
    holiday: 'Horas Feriados',
    grossPay: 'Salario Bruto',
    deductions: 'DEDUCCIONES',
    afp: 'AFP (Pensión 2.87%)',
    sfs: 'Salud (SFS 3.04%)',
    isr: 'Impuesto Sobre la Renta (ISR)',
    otherDed: 'Otras Deducciones',
    totalDed: 'Total Deducciones',
    netPay: 'SALARIO NETO',
    rate: 'Tarifa',
    generatedOn: 'Generado el',
  },
}

export function PayStubDocument({ entry, company, startDate, endDate, lang }: Props) {
  const { employee: emp, calculation: c, hours: h } = entry
  const l = labels[lang]
  const today = new Date().toLocaleDateString(lang === 'es' ? 'es-DO' : 'en-US')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>{company.name}</Text>
            {company.rnc && <Text style={styles.companyInfo}>RNC: {company.rnc}</Text>}
            {company.address && <Text style={styles.companyInfo}>{company.address}</Text>}
            {company.phone && <Text style={styles.companyInfo}>{company.phone}</Text>}
          </View>
          <View>
            <Text style={styles.title}>{l.payStub}</Text>
            <Text style={styles.periodText}>{l.period}: {startDate} – {endDate}</Text>
          </View>
        </View>

        {/* Employee info */}
        <View style={styles.employeeBox}>
          <Text style={styles.empName}>{emp.firstName} {emp.lastName}</Text>
          <Text style={styles.empDetail}>{l.jobTitle}: {emp.jobTitle || '—'}</Text>
          <Text style={styles.empDetail}>{l.department}: {emp.department || '—'}</Text>
          <Text style={styles.empDetail}>{l.employee} ID: {emp.id}</Text>
        </View>

        {/* Earnings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{l.earnings}</Text>
          {h.regularHours > 0 && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{l.regular} ({h.regularHours} hrs × {fmt(emp.payRate)})</Text>
              <Text style={styles.rowValue}>{fmt(c.regularPay)}</Text>
            </View>
          )}
          {h.otHours > 0 && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{l.ot} ({h.otHours} hrs × {fmt(emp.payRate)} × 1.35)</Text>
              <Text style={styles.rowValue}>{fmt(c.otPay)}</Text>
            </View>
          )}
          {h.holidayHours > 0 && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{l.holiday} ({h.holidayHours} hrs × {fmt(emp.payRate)} × 2.00)</Text>
              <Text style={styles.rowValue}>{fmt(c.holidayPay)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{l.grossPay}</Text>
            <Text style={styles.totalLabel}>{fmt(c.grossPay)}</Text>
          </View>
        </View>

        {/* Deductions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{l.deductions}</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{l.afp}</Text>
            <Text style={styles.rowValueNeg}>({fmt(c.afpAmount)})</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{l.sfs}</Text>
            <Text style={styles.rowValueNeg}>({fmt(c.sfsAmount)})</Text>
          </View>
          {c.isrPeriod > 0 && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{l.isr}</Text>
              <Text style={styles.rowValueNeg}>({fmt(c.isrPeriod)})</Text>
            </View>
          )}
          {c.customDeductionsBreakdown.map((d) => (
            <View key={d.name} style={styles.row}>
              <Text style={styles.rowLabel}>{d.name}</Text>
              <Text style={styles.rowValueNeg}>({fmt(d.amount)})</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{l.totalDed}</Text>
            <Text style={styles.rowValueNeg}>({fmt(c.totalDeductions)})</Text>
          </View>
        </View>

        {/* Net pay */}
        <View style={styles.netBox}>
          <Text style={styles.netLabel}>{l.netPay}</Text>
          <Text style={styles.netValue}>{fmt(c.netPay)}</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{company.name} — {company.rnc ? `RNC ${company.rnc}` : ''}</Text>
          <Text style={styles.footerText}>{l.generatedOn} {today}</Text>
        </View>
      </Page>
    </Document>
  )
}
