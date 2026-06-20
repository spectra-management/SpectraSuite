import type { Employee } from '@/shared/types'
import type { ReportColumn } from '@/modules/nomina/lib/pdf/employeeReportPdf'
import { formatPayRate, formatDate } from '@/shared/lib/utils'

function getCellValue(emp: Employee, col: ReportColumn): string {
  switch (col) {
    case 'name': return `${emp.firstName} ${emp.lastName}`
    case 'email': return emp.workEmail
    case 'department': return emp.department || ''
    case 'jobTitle': return emp.jobTitle || ''
    case 'payRate': return formatPayRate(emp.payRate, emp.payRateCurrency)
    case 'payType': return emp.payType
    case 'hireDate': return formatDate(emp.hireDate)
    case 'status': return emp.status
  }
}

export function generateCSV(employees: Employee[], columns: ReportColumn[], colLabels: Record<ReportColumn, string>): string {
  const header = columns.map((c) => `"${colLabels[c]}"`).join(',')
  const rows = employees.map((emp) =>
    columns.map((c) => `"${getCellValue(emp, c).replace(/"/g, '""')}"`).join(','),
  )
  return [header, ...rows].join('\n')
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function generateHeadcountCSV(employees: Employee[]): string {
  const byDept: Record<string, number> = {}
  for (const emp of employees) {
    const d = emp.department || '(No Department)'
    byDept[d] = (byDept[d] ?? 0) + 1
  }
  const rows = Object.entries(byDept)
    .sort((a, b) => b[1] - a[1])
    .map(([dept, count]) => `"${dept}","${count}"`)
  return ['"Department","Count"', ...rows].join('\n')
}
