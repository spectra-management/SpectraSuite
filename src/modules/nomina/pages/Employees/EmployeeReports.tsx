import { useState } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Download, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { toast } from '@/shared/hooks/useToast'
import { generateCSV, downloadCSV, generateHeadcountCSV } from '@/modules/nomina/lib/reports/employeeReports'
import { generatePdfBlob, downloadBlob } from '@/modules/nomina/lib/pdf/generatePdf'
import type { Employee } from '@/shared/types'
import type { ReportColumn } from '@/modules/nomina/lib/pdf/employeeReportPdf'

const ALL_COLUMNS: { key: ReportColumn; labelKey: string }[] = [
  { key: 'name', labelKey: 'employees.reports.columns.name' },
  { key: 'email', labelKey: 'employees.reports.columns.email' },
  { key: 'department', labelKey: 'employees.reports.columns.department' },
  { key: 'jobTitle', labelKey: 'employees.reports.columns.jobTitle' },
  { key: 'payRate', labelKey: 'employees.reports.columns.payRate' },
  { key: 'payType', labelKey: 'employees.reports.columns.payType' },
  { key: 'hireDate', labelKey: 'employees.reports.columns.hireDate' },
  { key: 'status', labelKey: 'employees.reports.columns.status' },
]

const TEMPLATES: Record<string, ReportColumn[]> = {
  directory: ['name', 'email', 'department', 'jobTitle', 'hireDate', 'status'],
  compensation: ['name', 'jobTitle', 'department', 'payRate', 'payType'],
}

interface Props {
  open: boolean
  onClose: () => void
  employees: Employee[]
}

export function EmployeeReports({ open, onClose, employees }: Props) {
  const { t } = useTranslation()
  const company = useSettingsStore((s) => s.company)
  const [columns, setColumns] = useState<ReportColumn[]>(TEMPLATES.directory)
  const [reportMode, setReportMode] = useState<'custom' | 'headcount'>('custom')
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)

  const colLabels = Object.fromEntries(
    ALL_COLUMNS.map(({ key, labelKey }) => [key, t(labelKey)]),
  ) as Record<ReportColumn, string>

  const toggleColumn = (col: ReportColumn) => {
    setColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    )
    setReportMode('custom')
  }

  const applyTemplate = (templateKey: keyof typeof TEMPLATES) => {
    setColumns(TEMPLATES[templateKey])
    setReportMode('custom')
  }

  const handleExportCSV = () => {
    if (reportMode === 'headcount') {
      const csv = generateHeadcountCSV(employees)
      downloadCSV(csv, `headcount-${new Date().toISOString().slice(0, 10)}.csv`)
    } else {
      const csv = generateCSV(employees, columns, colLabels)
      downloadCSV(csv, `employees-${new Date().toISOString().slice(0, 10)}.csv`)
    }
    toast({ variant: 'success', title: 'CSV exported' })
  }

  const handleExportPDF = async () => {
    setExporting('pdf')
    try {
      const { EmployeeReportDocument } = await import('@/modules/nomina/lib/pdf/employeeReportPdf')
      const isHeadcount = reportMode === 'headcount'
      const element = React.createElement(EmployeeReportDocument, {
        employees,
        columns,
        company,
        reportTitle: isHeadcount ? t('employees.reports.headcount') : t('employees.reports.title'),
        generatedOn: t('employees.reports.generatedOn'),
        totalLabel: t('employees.reports.totalEmployees'),
        avgLabel: t('employees.reports.avgPayRate'),
        isHeadcount,
      })
      const blob = await generatePdfBlob(element)
      downloadBlob(blob, `employees-${new Date().toISOString().slice(0, 10)}.pdf`)
      toast({ variant: 'success', title: 'PDF exported' })
    } catch {
      toast({ variant: 'destructive', title: t('errors.pdfFailed') })
    } finally {
      setExporting(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            {t('employees.reports.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('employees.reports.subtitle')}</DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{t('employees.reports.subtitle')}</p>

        {/* Predefined templates */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('employees.reports.predefinedReports')}
          </p>
          <div className="grid grid-cols-1 gap-2">
            {[
              { key: 'directory', titleKey: 'employees.reports.directory', descKey: 'employees.reports.directoryDesc' },
              { key: 'compensation', titleKey: 'employees.reports.compensation', descKey: 'employees.reports.compensationDesc' },
            ].map((tpl) => (
              <button
                key={tpl.key}
                type="button"
                onClick={() => applyTemplate(tpl.key as keyof typeof TEMPLATES)}
                className="flex flex-col items-start rounded-lg border border-input p-3 text-left hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{t(tpl.titleKey)}</span>
                <span className="text-xs text-muted-foreground">{t(tpl.descKey)}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setReportMode('headcount')}
              className={`flex flex-col items-start rounded-lg border p-3 text-left transition-colors ${
                reportMode === 'headcount'
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-input hover:border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              <span className="text-sm font-medium text-foreground">{t('employees.reports.headcount')}</span>
              <span className="text-xs text-muted-foreground">{t('employees.reports.headcountDesc')}</span>
            </button>
          </div>
        </div>

        {reportMode !== 'headcount' && (
          <>
            <Separator />
            {/* Column selector */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t('employees.reports.selectColumns')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_COLUMNS.map(({ key, labelKey }) => (
                  <div key={key} className="flex items-center gap-2">
                    <Checkbox
                      id={`col-${key}`}
                      checked={columns.includes(key)}
                      onCheckedChange={() => toggleColumn(key)}
                    />
                    <Label htmlFor={`col-${key}`} className="text-sm font-normal cursor-pointer">
                      {t(labelKey)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />

        {/* Summary */}
        <p className="text-xs text-muted-foreground">
          {employees.length} {t('common.employees')} · {reportMode === 'headcount' ? t('employees.reports.headcount') : `${columns.length} columns`}
        </p>

        {/* Export buttons */}
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleExportCSV}
            disabled={exporting !== null || (reportMode !== 'headcount' && columns.length === 0)}
          >
            <Download className="mr-2 h-4 w-4" />
            {t('employees.reports.exportCsv')}
          </Button>
          <Button
            className="flex-1"
            onClick={handleExportPDF}
            disabled={exporting !== null || (reportMode !== 'headcount' && columns.length === 0)}
          >
            {exporting === 'pdf'
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <FileText className="mr-2 h-4 w-4" />}
            {exporting === 'pdf' ? t('employees.reports.generating') : t('employees.reports.exportPdf')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
