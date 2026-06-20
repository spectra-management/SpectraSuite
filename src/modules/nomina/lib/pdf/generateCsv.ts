import type { PayrollEntry } from '@/shared/types'
import { roundHalfUp } from '@/modules/nomina/lib/payroll/calculations'

function csvCell(value: string | number): string {
  const str = String(value)
  // Quote cells that contain commas, quotes, or newlines
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(',')
}

function rd(n: number): string {
  return roundHalfUp(n, 2).toFixed(2)
}

export function generatePayrollCSV(
  startDate: string,
  endDate: string,
  entries: PayrollEntry[],
): string {
  const header = [
    'Employee', 'Department', 'Job Title', 'Email',
    'Regular Hours', 'OT Hours', 'Holiday Hours',
    'Gross Pay', 'AFP', 'SFS', 'TSS Total', 'ISR',
    'Other Deductions', 'Total Deductions', 'Net Pay',
  ]

  const rows = entries.map((e) => [
    `${e.employee.firstName} ${e.employee.lastName}`,
    e.employee.department || '',
    e.employee.jobTitle || '',
    e.employee.workEmail || '',
    rd(e.hours.regularHours),
    rd(e.hours.otHours),
    rd(e.hours.holidayHours),
    rd(e.calculation.grossPay),
    rd(e.calculation.afpAmount),
    rd(e.calculation.sfsAmount),
    rd(e.calculation.tssTotal),
    rd(e.calculation.isrPeriod),
    rd(e.calculation.customDeductions),
    rd(e.calculation.totalDeductions),
    rd(e.calculation.netPay),
  ])

  const lines = [
    `# Payroll Report: ${startDate} – ${endDate}`,
    '',
    csvRow(header),
    ...rows.map(csvRow),
  ]

  return lines.join('\n')
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
