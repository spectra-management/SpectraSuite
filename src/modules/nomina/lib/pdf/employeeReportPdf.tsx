import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { Employee, CompanySettings } from '@/shared/types'
import { formatPayRate, formatDate } from '@/shared/lib/utils'

const S = StyleSheet.create({
  page: { fontFamily: 'Roboto', fontSize: 9, padding: 32, backgroundColor: '#FFFFFF', color: '#111827' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1 solid #E5E7EB' },
  companyName: { fontSize: 13, fontFamily: 'Roboto', fontWeight: 700, color: '#059669' },
  companyMeta: { fontSize: 8, color: '#6B7280', marginTop: 2 },
  reportTitle: { fontSize: 11, fontFamily: 'Roboto', fontWeight: 700, color: '#111827', textAlign: 'right' },
  reportDate: { fontSize: 8, color: '#6B7280', textAlign: 'right', marginTop: 2 },
  table: { marginTop: 8 },
  thead: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderBottom: '1 solid #E5E7EB', paddingVertical: 5, paddingHorizontal: 4 },
  th: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', flex: 1 },
  row: { flexDirection: 'row', borderBottom: '1 solid #F3F4F6', paddingVertical: 5, paddingHorizontal: 4 },
  rowAlt: { flexDirection: 'row', borderBottom: '1 solid #F3F4F6', paddingVertical: 5, paddingHorizontal: 4, backgroundColor: '#F9FAFB' },
  cell: { fontSize: 8, color: '#374151', flex: 1 },
  cellRight: { fontSize: 8, color: '#374151', flex: 1, textAlign: 'right' },
  footer: { marginTop: 16, paddingTop: 10, borderTop: '1 solid #E5E7EB', flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7, color: '#9CA3AF' },
  summary: { flexDirection: 'row', gap: 16, marginTop: 14 },
  summaryBox: { backgroundColor: '#ECFDF5', borderRadius: 4, padding: 8, flex: 1 },
  summaryLabel: { fontSize: 7, color: '#065F46' },
  summaryValue: { fontSize: 11, fontFamily: 'Roboto', fontWeight: 700, color: '#059669', marginTop: 2 },
  section: { marginTop: 14 },
  sectionTitle: { fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: '#059669', marginBottom: 6, paddingBottom: 3, borderBottom: '1 solid #E5E7EB' },
})

export type ReportColumn = 'name' | 'email' | 'department' | 'jobTitle' | 'payRate' | 'payType' | 'hireDate' | 'status'

interface Props {
  employees: Employee[]
  columns: ReportColumn[]
  company: CompanySettings
  reportTitle: string
  generatedOn: string
  totalLabel: string
  avgLabel: string
  isHeadcount?: boolean
}

function colWidth(col: ReportColumn): number {
  if (col === 'name') return 2
  if (col === 'email') return 2
  return 1
}

export function EmployeeReportDocument({ employees, columns, company, reportTitle, generatedOn, totalLabel, avgLabel, isHeadcount }: Props) {
  const today = new Date().toLocaleDateString('en-US')
  const avgRate = employees.filter((e) => e.payRate > 0).length > 0
    ? employees.filter((e) => e.payRate > 0).reduce((s, e) => s + e.payRate, 0) / employees.filter((e) => e.payRate > 0).length
    : 0

  if (isHeadcount) {
    const byDept: Record<string, Employee[]> = {}
    for (const emp of employees) {
      const d = emp.department || '(No Department)'
      if (!byDept[d]) byDept[d] = []
      byDept[d].push(emp)
    }
    const depts = Object.entries(byDept).sort((a, b) => b[1].length - a[1].length)

    return (
      <Document>
        <Page size="A4" style={S.page}>
          <View style={S.header}>
            <View>
              <Text style={S.companyName}>{company.name}</Text>
              {company.rnc ? <Text style={S.companyMeta}>RNC: {company.rnc}</Text> : null}
            </View>
            <View>
              <Text style={S.reportTitle}>{reportTitle}</Text>
              <Text style={S.reportDate}>{generatedOn} {today}</Text>
            </View>
          </View>
          <View style={S.summary}>
            <View style={S.summaryBox}>
              <Text style={S.summaryLabel}>{totalLabel}</Text>
              <Text style={S.summaryValue}>{employees.length}</Text>
            </View>
            <View style={S.summaryBox}>
              <Text style={S.summaryLabel}>{Object.keys(byDept).length} Departments</Text>
              <Text style={S.summaryValue}>{Object.keys(byDept).length}</Text>
            </View>
          </View>
          {depts.map(([dept, emps]) => (
            <View key={dept} style={S.section}>
              <Text style={S.sectionTitle}>{dept} — {emps.length} employee{emps.length !== 1 ? 's' : ''}</Text>
              {emps.map((emp, i) => (
                <View key={emp.id} style={i % 2 === 0 ? S.row : S.rowAlt}>
                  <Text style={S.cell}>{emp.firstName} {emp.lastName}</Text>
                  <Text style={S.cell}>{emp.jobTitle || '—'}</Text>
                  <Text style={S.cell}>{emp.status}</Text>
                </View>
              ))}
            </View>
          ))}
          <View style={S.footer}>
            <Text style={S.footerText}>{company.name}</Text>
            <Text style={S.footerText}>{generatedOn} {today}</Text>
          </View>
        </Page>
      </Document>
    )
  }

  // Guard against an empty column set → flex would be 0/0 = NaN, which @react-pdf rejects.
  const totalFlexWidth = columns.reduce((s, c) => s + colWidth(c), 0) || 1

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={S.page}>
        <View style={S.header}>
          <View>
            <Text style={S.companyName}>{company.name}</Text>
            {company.rnc ? <Text style={S.companyMeta}>RNC: {company.rnc}</Text> : null}
          </View>
          <View>
            <Text style={S.reportTitle}>{reportTitle}</Text>
            <Text style={S.reportDate}>{generatedOn} {today}</Text>
          </View>
        </View>

        <View style={S.summary}>
          <View style={S.summaryBox}>
            <Text style={S.summaryLabel}>{totalLabel}</Text>
            <Text style={S.summaryValue}>{employees.length}</Text>
          </View>
          {columns.includes('payRate') && avgRate > 0 && (
            <View style={S.summaryBox}>
              <Text style={S.summaryLabel}>{avgLabel}</Text>
              <Text style={S.summaryValue}>{formatPayRate(avgRate, employees[0]?.payRateCurrency)}</Text>
            </View>
          )}
        </View>

        <View style={[S.table, { marginTop: 12 }]}>
          <View style={S.thead}>
            {columns.map((col) => (
              <Text key={col} style={[S.th, { flex: colWidth(col) / totalFlexWidth * columns.length }]}>
                {col === 'name' ? 'Name' : col === 'email' ? 'Email' : col === 'department' ? 'Department'
                  : col === 'jobTitle' ? 'Job Title' : col === 'payRate' ? 'Pay Rate'
                  : col === 'payType' ? 'Pay Type' : col === 'hireDate' ? 'Hire Date' : 'Status'}
              </Text>
            ))}
          </View>
          {employees.map((emp, i) => (
            <View key={emp.id} style={i % 2 === 0 ? S.row : S.rowAlt}>
              {columns.map((col) => {
                const flex = colWidth(col) / totalFlexWidth * columns.length
                let value = ''
                if (col === 'name') value = `${emp.firstName} ${emp.lastName}`
                else if (col === 'email') value = emp.workEmail
                else if (col === 'department') value = emp.department || '—'
                else if (col === 'jobTitle') value = emp.jobTitle || '—'
                else if (col === 'payRate') value = formatPayRate(emp.payRate, emp.payRateCurrency)
                else if (col === 'payType') value = emp.payType
                else if (col === 'hireDate') value = formatDate(emp.hireDate)
                else if (col === 'status') value = emp.status
                return <Text key={col} style={[col === 'payRate' ? S.cellRight : S.cell, { flex }]}>{value}</Text>
              })}
            </View>
          ))}
        </View>

        <View style={S.footer}>
          <Text style={S.footerText}>{company.name}</Text>
          <Text style={S.footerText}>{generatedOn} {today}</Text>
        </View>
      </Page>
    </Document>
  )
}
