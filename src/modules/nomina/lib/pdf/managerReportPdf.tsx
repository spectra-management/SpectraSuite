import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import type { PayrollEntry, PayrollTotals, CompanySettings } from '@/shared/types'
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
const RED = '#DC2626'

const S = StyleSheet.create({
  page: { fontFamily: 'Roboto', fontSize: 8, padding: '28 32', backgroundColor: '#FFFFFF', color: GRAY_900 },

  // ── Header ──────────────────────────────────────────────────────────────────
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

  // ── Section title ────────────────────────────────────────────────────────────
  sectionTitle: { fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 14, paddingBottom: 3, borderBottom: `1 solid ${GRAY_200}` },

  // ── Executive summary cards ──────────────────────────────────────────────────
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: GRAY_50, borderRadius: 5, padding: '8 10', borderLeft: `3 solid ${GRAY_200}` },
  summaryCardEmph: { flex: 1, backgroundColor: EMERALD_LIGHT, borderRadius: 5, padding: '8 10', borderLeft: `3 solid ${EMERALD}` },
  summaryLabel: { fontSize: 7, color: GRAY_500, marginBottom: 3 },
  summaryValue: { fontSize: 11, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900 },
  summaryValueEmph: { fontSize: 11, fontFamily: 'Roboto', fontWeight: 700, color: EMERALD },
  summaryBreakRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  summaryBreakLabel: { fontSize: 7, color: GRAY_500 },
  summaryBreakValue: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: RED },

  // ── Detail table ────────────────────────────────────────────────────────────
  tHead: { flexDirection: 'row', backgroundColor: EMERALD, padding: '4 6', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  tHeadText: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: '#FFFFFF', textAlign: 'right' },
  tHeadLeft: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: '#FFFFFF' },
  tRow: { flexDirection: 'row', padding: '3.5 6', borderBottom: `0.5 solid ${GRAY_100}` },
  tRowAlt: { flexDirection: 'row', padding: '3.5 6', borderBottom: `0.5 solid ${GRAY_100}`, backgroundColor: GRAY_50 },
  tCell: { fontSize: 7, color: GRAY_700, textAlign: 'right' },
  tCellLeft: { fontSize: 7, color: GRAY_700 },
  tCellBold: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900, textAlign: 'right' },
  tCellRed: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: RED, textAlign: 'right' },
  tCellGreen: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: EMERALD, textAlign: 'right' },
  tTotal: { flexDirection: 'row', padding: '4.5 6', borderTop: `1.5 solid ${GRAY_200}`, backgroundColor: GRAY_100 },
  tTotalLabel: { fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900 },
  tTotalValue: { fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, color: GRAY_900, textAlign: 'right' },
  tTotalGreen: { fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, color: EMERALD, textAlign: 'right' },
  tTotalRed: { fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, color: RED, textAlign: 'right' },

  // ── Dept table ──────────────────────────────────────────────────────────────
  dHead: { flexDirection: 'row', backgroundColor: GRAY_700, padding: '4 6', borderTopLeftRadius: 3, borderTopRightRadius: 3 },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: { marginTop: 20, paddingTop: 10, borderTop: `1 solid ${GRAY_200}` },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  signBox: { flex: 1, borderTop: `1 solid ${GRAY_700}`, paddingTop: 5, marginRight: 40 },
  signLabel: { fontSize: 7.5, color: GRAY_500 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: GRAY_500 },
})

function fmt(n: number): string {
  return `RD$ ${roundHalfUp(safeNum(n), 2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function num(n: number): string {
  return roundHalfUp(safeNum(n), 2).toFixed(2)
}

interface DeptRow {
  dept: string
  count: number
  gross: number
  afp: number
  sfs: number
  isr: number
  customDed: number
  deductions: number
  net: number
}

function buildDeptSummary(entries: PayrollEntry[]): DeptRow[] {
  const map = new Map<string, DeptRow>()
  for (const e of entries) {
    const dept = e.employee.department || 'Unassigned'
    const cur = map.get(dept) ?? { dept, count: 0, gross: 0, afp: 0, sfs: 0, isr: 0, customDed: 0, deductions: 0, net: 0 }
    map.set(dept, {
      dept,
      count: cur.count + 1,
      gross: roundHalfUp(cur.gross + e.calculation.grossPay),
      afp: roundHalfUp(cur.afp + e.calculation.afpAmount),
      sfs: roundHalfUp(cur.sfs + e.calculation.sfsAmount),
      isr: roundHalfUp(cur.isr + e.calculation.isrPeriod),
      customDed: roundHalfUp(cur.customDed + e.calculation.customDeductions),
      deductions: roundHalfUp(cur.deductions + e.calculation.totalDeductions),
      net: roundHalfUp(cur.net + e.calculation.netPay),
    })
  }
  return [...map.values()].sort((a, b) => a.dept.localeCompare(b.dept))
}

export interface ManagerReportProps {
  startDate: string
  endDate: string
  frequency: 'biweekly' | 'weekly' | 'full_month'
  entries: PayrollEntry[]
  totals: PayrollTotals
  company: CompanySettings
  lang: 'en' | 'es'
}

const RL = {
  en: {
    title: 'PAYROLL MANAGER REPORT',
    period: 'Pay Period',
    generated: 'Generated',
    rnc: 'RNC',
    execSummary: 'EXECUTIVE SUMMARY',
    totalEmp: 'Employees Processed',
    totalGross: 'Total Gross Payroll',
    totalAfp: 'Total AFP',
    totalSfs: 'Total SFS',
    totalTss: 'Total TSS',
    totalIsr: 'Total ISR',
    totalDed: 'Total Deductions',
    totalNet: 'Total Net to Pay',
    detail: 'EMPLOYEE DETAIL',
    employee: 'Employee',
    dept: 'Department',
    regHrs: 'Reg.Hrs',
    otHrs: 'OT Hrs',
    holHrs: 'Hol.Hrs',
    gross: 'Gross',
    afp: 'AFP',
    sfs: 'SFS',
    isr: 'ISR',
    otherDed: 'Other Ded.',
    net: 'Net Pay',
    totals: 'TOTALS',
    deptSummary: 'DEPARTMENT SUMMARY',
    count: '# Emp',
    deptGross: 'Gross',
    deptDed: 'Deductions',
    deptNet: 'Net',
    signedBy: 'Authorized by',
    generatedBy: 'Generated by Spectra Nómina',
  },
  es: {
    title: 'REPORTE GERENCIAL DE NÓMINA',
    period: 'Período de Pago',
    generated: 'Generado',
    rnc: 'RNC',
    execSummary: 'RESUMEN EJECUTIVO',
    totalEmp: 'Empleados Procesados',
    totalGross: 'Total Bruto de Nómina',
    totalAfp: 'Total AFP',
    totalSfs: 'Total SFS',
    totalTss: 'Total TSS',
    totalIsr: 'Total ISR',
    totalDed: 'Total Deducciones',
    totalNet: 'Total Neto a Pagar',
    detail: 'DETALLE POR EMPLEADO',
    employee: 'Empleado',
    dept: 'Depto.',
    regHrs: 'Hrs Reg.',
    otHrs: 'Hrs OT',
    holHrs: 'Hrs Fer.',
    gross: 'Bruto',
    afp: 'AFP',
    sfs: 'SFS',
    isr: 'ISR',
    otherDed: 'Otras Ded.',
    net: 'Neto',
    totals: 'TOTALES',
    deptSummary: 'RESUMEN POR DEPARTAMENTO',
    count: '# Emp',
    deptGross: 'Bruto',
    deptDed: 'Deducciones',
    deptNet: 'Neto',
    signedBy: 'Autorizado por',
    generatedBy: 'Generado por Spectra Nómina',
  },
}

export function ManagerReportDocument({
  startDate,
  endDate,
  frequency: _frequency,
  entries,
  totals,
  company,
  lang,
}: ManagerReportProps) {
  const l = RL[lang]
  const today = new Date().toLocaleDateString(lang === 'es' ? 'es-DO' : 'en-US')
  const deptRows = buildDeptSummary(entries)
  const logo = logoSrc(company.logoBase64)

  // Column flex widths for employee detail table
  const cName = 3.5, cDept = 2, cReg = 1.2, cOT = 1.2, cHol = 1.2
  const cGross = 2, cAfp = 1.8, cSfs = 1.8, cIsr = 1.8, cOtherDed = 1.8, cNet = 2

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={S.page}>

        {/* ── HEADER ── */}
        <View style={S.header}>
          <View style={S.logoWrap}>
            {logo && (
              <Image style={S.logo} src={logo} />
            )}
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
              <Text style={S.metaValue}>{startDate} – {endDate}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.metaLabel}>{l.generated}:</Text>
              <Text style={S.metaValue}>{today}</Text>
            </View>
          </View>
        </View>

        {/* ── EXECUTIVE SUMMARY ── */}
        <Text style={S.sectionTitle}>{l.execSummary}</Text>
        <View style={S.summaryRow}>
          <View style={S.summaryCard}>
            <Text style={S.summaryLabel}>{l.totalEmp}</Text>
            <Text style={S.summaryValue}>{totals.employeeCount}</Text>
          </View>
          <View style={S.summaryCard}>
            <Text style={S.summaryLabel}>{l.totalGross}</Text>
            <Text style={S.summaryValue}>{fmt(totals.totalGross)}</Text>
          </View>
          <View style={S.summaryCard}>
            <Text style={S.summaryLabel}>{l.totalDed}</Text>
            <Text style={S.summaryValue}>{fmt(totals.totalDeductions)}</Text>
            <View style={S.summaryBreakRow}>
              <Text style={S.summaryBreakLabel}>{l.totalTss}</Text>
              <Text style={S.summaryBreakValue}>{fmt(totals.totalTss)}</Text>
            </View>
            <View style={S.summaryBreakRow}>
              <Text style={S.summaryBreakLabel}>{l.totalIsr}</Text>
              <Text style={S.summaryBreakValue}>{fmt(totals.totalIsr)}</Text>
            </View>
          </View>
          <View style={S.summaryCardEmph}>
            <Text style={S.summaryLabel}>{l.totalNet}</Text>
            <Text style={S.summaryValueEmph}>{fmt(totals.totalNet)}</Text>
          </View>
        </View>

        {/* ── EMPLOYEE DETAIL TABLE ── */}
        <Text style={S.sectionTitle}>{l.detail}</Text>
        <View>
          {/* Header */}
          <View style={S.tHead}>
            <Text style={[S.tHeadLeft, { flex: cName }]}>{l.employee}</Text>
            <Text style={[S.tHeadLeft, { flex: cDept }]}>{l.dept}</Text>
            <Text style={[S.tHeadText, { flex: cReg }]}>{l.regHrs}</Text>
            <Text style={[S.tHeadText, { flex: cOT }]}>{l.otHrs}</Text>
            <Text style={[S.tHeadText, { flex: cHol }]}>{l.holHrs}</Text>
            <Text style={[S.tHeadText, { flex: cGross }]}>{l.gross}</Text>
            <Text style={[S.tHeadText, { flex: cAfp }]}>{l.afp}</Text>
            <Text style={[S.tHeadText, { flex: cSfs }]}>{l.sfs}</Text>
            <Text style={[S.tHeadText, { flex: cIsr }]}>{l.isr}</Text>
            <Text style={[S.tHeadText, { flex: cOtherDed }]}>{l.otherDed}</Text>
            <Text style={[S.tHeadText, { flex: cNet }]}>{l.net}</Text>
          </View>

          {/* Rows */}
          {entries.map((e, idx) => {
            const RowStyle = idx % 2 === 0 ? S.tRow : S.tRowAlt
            const emp = e.employee
            const c = e.calculation
            const h = e.hours
            return (
              <View key={emp.id} style={RowStyle}>
                <Text style={[S.tCellLeft, { flex: cName }]}>{emp.firstName} {emp.lastName}</Text>
                <Text style={[S.tCellLeft, { flex: cDept }]}>{emp.department || '—'}</Text>
                <Text style={[S.tCell, { flex: cReg }]}>{num(h.regularHours)}</Text>
                <Text style={[S.tCell, { flex: cOT }]}>{num(h.otHours)}</Text>
                <Text style={[S.tCell, { flex: cHol }]}>{num(h.holidayHours)}</Text>
                <Text style={[S.tCellBold, { flex: cGross }]}>{fmt(c.grossPay)}</Text>
                <Text style={[S.tCellRed, { flex: cAfp }]}>{fmt(c.afpAmount)}</Text>
                <Text style={[S.tCellRed, { flex: cSfs }]}>{fmt(c.sfsAmount)}</Text>
                <Text style={[S.tCellRed, { flex: cIsr }]}>{fmt(c.isrPeriod)}</Text>
                <Text style={[S.tCellRed, { flex: cOtherDed }]}>{fmt(c.customDeductions)}</Text>
                <Text style={[S.tCellGreen, { flex: cNet }]}>{fmt(c.netPay)}</Text>
              </View>
            )
          })}

          {/* Totals row */}
          <View style={S.tTotal}>
            <Text style={[S.tTotalLabel, { flex: cName + cDept + cReg + cOT + cHol }]}>{l.totals}</Text>
            <Text style={[S.tTotalValue, { flex: cGross }]}>{fmt(totals.totalGross)}</Text>
            <Text style={[S.tTotalRed, { flex: cAfp }]}>{fmt(totals.totalAfp)}</Text>
            <Text style={[S.tTotalRed, { flex: cSfs }]}>{fmt(totals.totalSfs)}</Text>
            <Text style={[S.tTotalRed, { flex: cIsr }]}>{fmt(totals.totalIsr)}</Text>
            <Text style={[S.tTotalRed, { flex: cOtherDed }]}>{fmt(totals.totalCustomDeductions)}</Text>
            <Text style={[S.tTotalGreen, { flex: cNet }]}>{fmt(totals.totalNet)}</Text>
          </View>
        </View>

        {/* ── DEPARTMENT SUMMARY ── */}
        <Text style={S.sectionTitle}>{l.deptSummary}</Text>
        <View>
          <View style={S.dHead}>
            <Text style={[S.tHeadLeft, { flex: 3.5 }]}>{l.dept}</Text>
            <Text style={[S.tHeadText, { flex: 1 }]}>{l.count}</Text>
            <Text style={[S.tHeadText, { flex: 2.5 }]}>{l.deptGross}</Text>
            <Text style={[S.tHeadText, { flex: 2.5 }]}>{l.totalAfp} + {l.totalSfs}</Text>
            <Text style={[S.tHeadText, { flex: 2 }]}>{l.totalIsr}</Text>
            <Text style={[S.tHeadText, { flex: 2.5 }]}>{l.deptDed}</Text>
            <Text style={[S.tHeadText, { flex: 2.5 }]}>{l.deptNet}</Text>
          </View>
          {deptRows.map((d, idx) => {
            const RowStyle = idx % 2 === 0 ? S.tRow : S.tRowAlt
            return (
              <View key={d.dept} style={RowStyle}>
                <Text style={[S.tCellLeft, { flex: 3.5 }]}>{d.dept}</Text>
                <Text style={[S.tCell, { flex: 1 }]}>{d.count}</Text>
                <Text style={[S.tCellBold, { flex: 2.5 }]}>{fmt(d.gross)}</Text>
                <Text style={[S.tCellRed, { flex: 2.5 }]}>{fmt(roundHalfUp(d.afp + d.sfs))}</Text>
                <Text style={[S.tCellRed, { flex: 2 }]}>{fmt(d.isr)}</Text>
                <Text style={[S.tCellRed, { flex: 2.5 }]}>{fmt(d.deductions)}</Text>
                <Text style={[S.tCellGreen, { flex: 2.5 }]}>{fmt(d.net)}</Text>
              </View>
            )
          })}
        </View>

        {/* ── FOOTER / SIGNATURE ── */}
        <View style={S.footer}>
          <View style={S.signRow}>
            <View style={S.signBox}>
              <Text style={S.signLabel}>{l.signedBy}</Text>
            </View>
            <View style={{ flex: 1 }} />
          </View>
          <View style={S.footerRow}>
            <Text style={S.footerText}>{company.name}{company.rnc ? ` — ${l.rnc} ${company.rnc}` : ''}</Text>
            <Text style={S.footerText}>{l.generatedBy} · {today}</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}
