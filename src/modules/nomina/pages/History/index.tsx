import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import React from 'react'
import { History as HistoryIcon, Download, Mail, Send, Loader2, ChevronDown, ChevronRight, FileText, Table } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Progress } from '@/shared/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { usePayrollStore } from '@/shared/store/payrollStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { usePaymentMethodsStore } from '@/shared/store/paymentMethodsStore'
import { useBankAccountsStore } from '@/shared/store/bankAccountsStore'
import { toast } from '@/shared/hooks/useToast'
import { formatCurrency, formatDate } from '@/shared/lib/utils'
import { generatePdfBlob, downloadBlob, blobToBase64 } from '@/modules/nomina/lib/pdf/generatePdf'
import { generatePayrollCSV, downloadCSV } from '@/modules/nomina/lib/pdf/generateCsv'
import type { PayrollPeriod, SendResult, CompanySettings, EmailTemplate } from '@/shared/types'
import type { PayrollEntry } from '@/shared/types'

async function loadPayStub() {
  const { PayStubDocument } = await import('@/modules/nomina/lib/pdf/payStubPdf')
  return PayStubDocument
}

async function buildStubElement(
  entry: PayrollEntry,
  company: CompanySettings,
  startDate: string,
  endDate: string,
  lang: EmailTemplate['payStubLanguage'],
  country?: string,
) {
  const PayStubDocument = await loadPayStub()
  const paymentMethod = usePaymentMethodsStore.getState().getMethod(entry.employee.id)
  const bankAccount = useBankAccountsStore.getState().getAccount(entry.employee.id)
  return React.createElement(PayStubDocument, { entry, company, startDate, endDate, lang, country, paymentMethod, bankAccount })
}

function statusVariant(status: PayrollPeriod['status']): 'default' | 'secondary' | 'info' | 'warning' {
  if (status === 'approved') return 'default'
  if (status === 'sent') return 'info'
  return 'secondary'
}

interface BatchStatus {
  total: number
  done: number
  results: SendResult[]
  running: boolean
}

function PayrollRow({ payroll }: { payroll: PayrollPeriod }) {
  const { t, i18n } = useTranslation()
  const company = useSettingsStore((s) => s.company)
  const emailConfig = useSettingsStore((s) => s.email)
  const emailTemplate = useSettingsStore((s) => s.emailTemplate)
  const updatePayroll = usePayrollStore((s) => s.updatePayroll)
  const [expanded, setExpanded] = useState(false)
  const [batch, setBatch] = useState<BatchStatus | null>(null)
  const [downloadingAll, setDownloadingAll] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const lang = (i18n.language?.startsWith('es') ? 'es' : 'en') as 'en' | 'es'

  const handleDownloadPdf = async (entryIdx: number) => {
    const entry = payroll.entries[entryIdx]
    if (!entry) return
    try {
      const element = await buildStubElement(
        entry,
        company,
        payroll.startDate,
        payroll.endDate,
        emailTemplate.payStubLanguage,
        payroll.country,
      )
      const blob = await generatePdfBlob(element)
      const fname = `Paystub_${entry.employee.firstName}_${entry.employee.lastName}_${payroll.startDate}_${payroll.endDate}.pdf`
      downloadBlob(blob, fname)
    } catch (err) {
      console.error('[PDF] Download paystub failed:', err)
      toast({ variant: 'destructive', title: t('errors.pdfFailed') })
    }
  }

  const handleSendEmail = async (entryIdx: number) => {
    const entry = payroll.entries[entryIdx]
    if (!entry) return
    if (!entry.employee.workEmail) {
      toast({ variant: 'destructive', title: t('errors.noEmail') })
      return
    }
    if (!emailConfig.connected || !emailConfig.resendApiKey) {
      toast({ variant: 'destructive', title: 'Email not configured. Set up in Connectors.' })
      return
    }
    try {
      const element = await buildStubElement(
        entry,
        company,
        payroll.startDate,
        payroll.endDate,
        emailTemplate.payStubLanguage,
      )
      const blob = await generatePdfBlob(element)
      const pdfBase64 = await blobToBase64(blob)
      const subject = emailTemplate.subject
        .replace('{name}', `${entry.employee.firstName} ${entry.employee.lastName}`)
        .replace('{period}', `${payroll.startDate} – ${payroll.endDate}`)
        .replace('{company}', company.name)
      const body = emailTemplate.body
        .replace('{name}', `${entry.employee.firstName} ${entry.employee.lastName}`)
        .replace('{period}', `${payroll.startDate} – ${payroll.endDate}`)
        .replace('{company}', company.name)

      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: entry.employee.workEmail,
          subject,
          html: body.replace(/\n/g, '<br>'),
          pdfBase64,
          pdfFilename: `paystub-${payroll.startDate}.pdf`,
          provider: 'resend',
          resendApiKey: emailConfig.resendApiKey,
          fromEmail: emailConfig.fromEmail,
          fromName: emailConfig.fromName,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast({ variant: 'success', title: t('common.success'), description: `Sent to ${entry.employee.workEmail}` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('errors.sendFailed')
      toast({ variant: 'destructive', title: t('errors.sendFailed'), description: msg })
    }
  }

  const handleSendAll = async () => {
    if (!emailConfig.connected || !emailConfig.resendApiKey) {
      toast({ variant: 'destructive', title: 'Email not configured. Set up in Connectors.' })
      return
    }
    const entries = payroll.entries
    setBatch({ total: entries.length, done: 0, results: [], running: true })

    const results: SendResult[] = []
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      try {
        if (!entry.employee.workEmail) throw new Error(t('errors.noEmail'))
        const element = await buildStubElement(
          entry,
          company,
          payroll.startDate,
          payroll.endDate,
          emailTemplate.payStubLanguage,
          payroll.country,
        )
        const blob = await generatePdfBlob(element)
        const pdfBase64 = await blobToBase64(blob)
        const subject = emailTemplate.subject
          .replace('{name}', `${entry.employee.firstName} ${entry.employee.lastName}`)
          .replace('{period}', `${payroll.startDate} – ${payroll.endDate}`)
          .replace('{company}', company.name)
        const body = emailTemplate.body
          .replace('{name}', `${entry.employee.firstName} ${entry.employee.lastName}`)
          .replace('{period}', `${payroll.startDate} – ${payroll.endDate}`)
          .replace('{company}', company.name)

        const res = await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: entry.employee.workEmail,
            subject,
            html: body.replace(/\n/g, '<br>'),
            pdfBase64,
            pdfFilename: `paystub-${payroll.startDate}.pdf`,
            provider: 'resend',
            resendApiKey: emailConfig.resendApiKey,
            fromEmail: emailConfig.fromEmail,
            fromName: emailConfig.fromName,
          }),
        })
        if (!res.ok) throw new Error(await res.text())
        results.push({ employeeId: entry.employee.id, success: true })
      } catch (err) {
        results.push({ employeeId: entry.employee.id, success: false, error: err instanceof Error ? err.message : 'Unknown' })
      }
      setBatch({ total: entries.length, done: i + 1, results: [...results], running: i < entries.length - 1 })
    }

    const succeeded = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length
    if (succeeded > 0) updatePayroll(payroll.id, { status: 'sent' })
    toast({
      variant: succeeded > 0 ? 'success' : 'destructive',
      title: `${succeeded} ${t('payroll.approve.sent')}, ${failed} ${t('payroll.approve.failed')}`,
    })
  }

  const handleDownloadAll = async () => {
    setDownloadingAll(true)
    for (const entry of payroll.entries) {
      try {
        const element = await buildStubElement(
          entry,
          company,
          payroll.startDate,
          payroll.endDate,
          emailTemplate.payStubLanguage,
          payroll.country,
        )
        const blob = await generatePdfBlob(element)
        const fname = `Paystub_${entry.employee.firstName}_${entry.employee.lastName}_${payroll.startDate}_${payroll.endDate}.pdf`
        downloadBlob(blob, fname)
        await new Promise((r) => setTimeout(r, 300))
      } catch {
        // continue with next
      }
    }
    setDownloadingAll(false)
  }

  const handleManagerReportPdf = async () => {
    setGeneratingReport(true)
    try {
      const { ManagerReportDocument } = await import('@/modules/nomina/lib/pdf/managerReportPdf')
      const element = React.createElement(ManagerReportDocument, {
        startDate: payroll.startDate,
        endDate: payroll.endDate,
        frequency: payroll.frequency,
        entries: payroll.entries,
        totals: payroll.totals,
        company,
        lang,
      })
      const blob = await generatePdfBlob(element)
      downloadBlob(blob, `ManagerReport_${payroll.startDate}_${payroll.endDate}.pdf`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      toast({ variant: 'destructive', title: 'PDF generation failed', description: msg })
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleManagerReportCsv = () => {
    const csv = generatePayrollCSV(payroll.startDate, payroll.endDate, payroll.entries)
    downloadCSV(csv, `ManagerReport_${payroll.startDate}_${payroll.endDate}.csv`)
  }

  return (
    <>
      <tr className="hover:bg-secondary transition-colors">
        <td className="px-6 py-4 font-medium text-foreground">
          <button
            className="flex items-center gap-2 text-left"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span className="text-base leading-none" title={payroll.country || 'Unknown'}>
              {countryFlag(payroll.country)}
            </span>
            {formatDate(payroll.startDate)} – {formatDate(payroll.endDate)}
          </button>
        </td>
        <td className="px-6 py-4 text-muted-foreground">
          {payroll.processedDate ? formatDate(payroll.processedDate) : '—'}
        </td>
        <td className="px-6 py-4 text-right text-muted-foreground">{payroll.totals.employeeCount}</td>
        <td className="px-6 py-4 text-right font-medium text-foreground">{formatCurrency(payroll.totals.totalGross)}</td>
        <td className="px-6 py-4 text-right font-semibold text-emerald-700">{formatCurrency(payroll.totals.totalNet)}</td>
        <td className="px-6 py-4">
          <Badge variant={statusVariant(payroll.status)}>
            {t(`history.status.${payroll.status}`)}
          </Badge>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-1 flex-wrap">
            <Button variant="ghost" size="sm" onClick={handleDownloadAll} disabled={downloadingAll} title={t('payroll.approve.downloadAll')}>
              {downloadingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSendAll} title={t('payroll.approve.sendAll')}>
              <Send className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleManagerReportPdf} disabled={generatingReport} title={t('payroll.managerReport.downloadPdf')}>
              {generatingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleManagerReportCsv} title={t('payroll.managerReport.downloadCsv')}>
              <Table className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>

      {/* Batch progress */}
      {batch && (
        <tr>
          <td colSpan={7} className="px-6 pb-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('history.sendingProgress', { done: batch.done, total: batch.total })}</span>
                <span>
                  {batch.results.filter((r) => r.success).length} {t('payroll.approve.sent')},
                  {' '}{batch.results.filter((r) => !r.success).length} {t('payroll.approve.failed')}
                </span>
              </div>
              <Progress value={(batch.done / batch.total) * 100} />
            </div>
          </td>
        </tr>
      )}

      {/* Expanded employee rows */}
      {expanded && (
        <tr>
          <td colSpan={7} className="px-6 pb-4">
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-secondary border-b border-border">
                    <th className="px-4 py-2 text-left text-muted-foreground font-semibold uppercase tracking-wide">Employee</th>
                    <th className="px-4 py-2 text-right text-muted-foreground font-semibold uppercase tracking-wide">Gross</th>
                    <th className="px-4 py-2 text-right text-muted-foreground font-semibold uppercase tracking-wide">Deductions</th>
                    <th className="px-4 py-2 text-right text-muted-foreground font-semibold uppercase tracking-wide">Net</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payroll.entries.map((entry, idx) => (
                    <tr key={entry.employee.id} className="hover:bg-secondary">
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {entry.employee.firstName} {entry.employee.lastName}
                        {entry.employee.workEmail && (
                          <span className="block text-muted-foreground font-normal">{entry.employee.workEmail}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCurrency(entry.calculation.grossPay)}</td>
                      <td className="px-4 py-2.5 text-right text-red-600">{formatCurrency(entry.calculation.totalDeductions)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-emerald-700">{formatCurrency(entry.calculation.netPay)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadPdf(idx)} className="h-6 text-xs px-2">
                            <Download className="mr-1 h-3 w-3" />
                            PDF
                          </Button>
                          {entry.employee.workEmail && (
                            <Button variant="ghost" size="sm" onClick={() => handleSendEmail(idx)} className="h-6 text-xs px-2">
                              <Mail className="mr-1 h-3 w-3" />
                              {t('common.sendEmail')}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function countryFlag(country: string | undefined): string {
  const c = (country ?? '').toLowerCase().trim()
  if (c.includes('dominican')) return '🇩🇴'
  if (c.includes('united states') || c === 'us') return '🇺🇸'
  if (c.includes('jamaica')) return '🇯🇲'
  if (c.includes('philippines') || c.includes('filipinas')) return '🇵🇭'
  if (c.includes('kenya')) return '🇰🇪'
  if (c.includes('mexico') || c.includes('méxico')) return '🇲🇽'
  if (c.includes('haiti')) return '🇭🇹'
  if (c.includes('puerto rico')) return '🇵🇷'
  if (c.includes('canada')) return '🇨🇦'
  if (c.includes('colombia')) return '🇨🇴'
  if (c.includes('venezuela')) return '🇻🇪'
  if (c.includes('panama') || c.includes('panamá')) return '🇵🇦'
  if (c.includes('costa rica')) return '🇨🇷'
  if (c.includes('cuba')) return '🇨🇺'
  return '🌍'
}

export default function History() {
  const { t } = useTranslation()
  const history = usePayrollStore((s) => s.history)
  const sorted = [...history].reverse()
  const [countryFilter, setCountryFilter] = useState('all')

  const availableCountries = useMemo(() => {
    const set = new Set<string>()
    for (const p of history) {
      const c = p.country && p.country.trim() ? p.country.trim() : 'Unknown'
      set.add(c)
    }
    return [...set].sort()
  }, [history])

  const filtered = useMemo(() => {
    if (countryFilter === 'all') return sorted
    return sorted.filter((p) => {
      const c = p.country && p.country.trim() ? p.country.trim() : 'Unknown'
      return c === countryFilter
    })
  }, [sorted, countryFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('history.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('history.subtitle')}</p>
      </div>

      {availableCountries.length > 1 && (
        <div className="flex items-center gap-3">
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t('history.filterAllCountries')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('history.filterAllCountries')}</SelectItem>
              {availableCountries.map((c) => (
                <SelectItem key={c} value={c}>
                  {countryFlag(c)} {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                <HistoryIcon className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t('history.noHistory')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('history.table.period')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('history.table.processedDate')}</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('history.table.employees')}</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('history.table.totalGross')}</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('history.table.totalNet')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('history.table.status')}</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => <PayrollRow key={p.id} payroll={p} />)}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
