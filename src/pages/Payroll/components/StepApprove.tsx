import { useState } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Loader2, DollarSign, Users, TrendingDown, FileText, Table } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePayrollStore } from '@/store/payrollStore'
import { useSettingsStore } from '@/store/settingsStore'
import { usePendingVacationIsrStore } from '@/store/pendingVacationIsrStore'
import { toast } from '@/hooks/useToast'
import { formatCurrency } from '@/lib/utils'
import { generatePdfBlob, downloadBlob } from '@/lib/pdf/generatePdf'
import { generatePayrollCSV, downloadCSV } from '@/lib/pdf/generateCsv'
import type { PayrollEntry, PayrollTotals } from '@/types'

interface Props {
  startDate: string
  endDate: string
  frequency: 'biweekly' | 'weekly' | 'full_month'
  country: string
  entries: PayrollEntry[]
  totals: PayrollTotals
  onBack: () => void
}

export function StepApprove({ startDate, endDate, frequency, country, entries, totals, onBack }: Props) {
  const { t, i18n } = useTranslation()
  const addPayroll = usePayrollStore((s) => s.addPayroll)
  const company = useSettingsStore((s) => s.company)
  const markVacationIsrApplied = usePendingVacationIsrStore((s) => s.markApplied)
  const navigate = useNavigate()
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)

  const lang = (i18n.language?.startsWith('es') ? 'es' : 'en') as 'en' | 'es'

  const handleApprove = async () => {
    setApproving(true)
    await new Promise((r) => setTimeout(r, 600))
    addPayroll({
      startDate,
      endDate,
      frequency,
      country,
      status: 'approved',
      processedDate: new Date().toISOString().split('T')[0],
      entries,
      totals,
    })
    // Mark any collected vacation ISR as applied to this period.
    for (const e of entries) {
      if (e.calculation.vacationIsr > 0) {
        markVacationIsrApplied(e.employee.id, `${startDate}/${endDate}`)
      }
    }
    setApproved(true)
    setApproving(false)
    toast({ variant: 'success', title: t('payroll.approve.approved') })
  }

  const handleManagerReportPdf = async () => {
    setGeneratingReport(true)
    try {
      const { ManagerReportDocument } = await import('@/lib/pdf/managerReportPdf')
      const element = React.createElement(ManagerReportDocument, {
        startDate, endDate, frequency, entries, totals, company, lang,
      })
      const blob = await generatePdfBlob(element)
      downloadBlob(blob, `ManagerReport_${startDate}_${endDate}.pdf`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      toast({ variant: 'destructive', title: 'PDF generation failed', description: msg })
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleManagerReportCsv = () => {
    const csv = generatePayrollCSV(startDate, endDate, entries)
    downloadCSV(csv, `ManagerReport_${startDate}_${endDate}.csv`)
  }

  const handleGoToHistory = () => navigate('/nomina/history')

  const ReportButtons = () => (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleManagerReportPdf}
        disabled={generatingReport}
        className="gap-1.5"
      >
        {generatingReport
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <FileText className="h-3.5 w-3.5" />
        }
        {t('payroll.managerReport.generate')} PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleManagerReportCsv}
        className="gap-1.5"
      >
        <Table className="h-3.5 w-3.5" />
        {t('payroll.managerReport.downloadCsv')}
      </Button>
    </div>
  )

  if (approved) {
    return (
      <Card className="max-w-lg">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-foreground">{t('payroll.approve.approved')}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Payroll for {startDate} – {endDate} has been approved.
          </p>
          <div className="mt-5 flex flex-col items-center gap-3">
            <div className="flex gap-3">
              <Button onClick={handleGoToHistory}>{t('nav.history')}</Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                New Payroll
              </Button>
            </div>
            <ReportButtons />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 max-w-xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('payroll.approve.title')}</CardTitle>
            <ReportButtons />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl bg-secondary p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Period</span>
              <span className="font-medium text-foreground">{startDate} – {endDate}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Frequency</span>
              <span className="font-medium text-foreground">{frequency}</span>
            </div>
            <div className="h-px bg-muted" />
            <SummaryRow
              icon={Users}
              label={t('dashboard.employeeCount')}
              value={String(totals.employeeCount)}
              iconClass="text-purple-500 bg-purple-50"
            />
            <SummaryRow
              icon={DollarSign}
              label={t('dashboard.totalGross')}
              value={formatCurrency(totals.totalGross)}
              iconClass="text-muted-foreground bg-secondary"
            />
            <SummaryRow
              icon={TrendingDown}
              label={t('dashboard.totalDeductions')}
              value={formatCurrency(totals.totalDeductions)}
              iconClass="text-red-500 bg-red-50"
            />
            <div className="h-px bg-muted" />
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">{t('dashboard.totalNet')}</span>
              <span className="text-xl font-bold text-emerald-700">{formatCurrency(totals.totalNet)}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{t('payroll.approve.confirmMessage')}</p>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack}>{t('common.back')}</Button>
            <Button onClick={handleApprove} disabled={approving}>
              {approving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              {t('payroll.approve.approve')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  iconClass,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  iconClass: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${iconClass}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}
