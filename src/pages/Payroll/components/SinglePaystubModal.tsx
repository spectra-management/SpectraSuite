import { useState, useMemo } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Mail, Loader2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/store/settingsStore'
import { calculatePayroll } from '@/lib/payroll/calculations'
import { roundHalfUp, formatCurrency } from '@/lib/payroll/calculations'
import { generatePdfBlob, downloadBlob, blobToBase64 } from '@/lib/pdf/generatePdf'
import { toast } from '@/hooks/useToast'
import type { Employee, EmployeeHoursEntry } from '@/types'

interface Props {
  employee: Employee
  hoursEntry: EmployeeHoursEntry
  startDate: string
  endDate: string
  frequency: 'biweekly' | 'weekly'
  onClose: () => void
}

export function SinglePaystubModal({ employee, hoursEntry, startDate, endDate, frequency, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const company = useSettingsStore((s) => s.company)
  const fiscal = useSettingsStore((s) => s.fiscal)
  const payrollSettings = useSettingsStore((s) => s.payroll)
  const emailConfig = useSettingsStore((s) => s.email)
  const emailTemplate = useSettingsStore((s) => s.emailTemplate)
  const lang = (i18n.language?.startsWith('es') ? 'es' : 'en') as 'en' | 'es'

  const [downloading, setDownloading] = useState(false)
  const [sending, setSending] = useState(false)

  const calculation = useMemo(() => calculatePayroll({
    employeeId: employee.id,
    hourlyRate: employee.payRate,
    regularHours: hoursEntry.regularHours,
    otHours: hoursEntry.otHours,
    holidayHours: hoursEntry.holidayHours,
    customDeductions: employee.customDeductions?.filter((d) => d.active) ?? [],
    fiscal,
    payroll: payrollSettings,
    frequency,
  }), [employee, hoursEntry, fiscal, payrollSettings, frequency])

  const entry = useMemo(() => ({
    employee,
    hours: hoursEntry,
    calculation,
  }), [employee, hoursEntry, calculation])

  const isrMonthlySalary = roundHalfUp(calculation.taxableIncome / 12)
  const otMultiplier = 1 + payrollSettings.otRatePercent / 100
  const holidayMultiplier = 1 + payrollSettings.holidayRatePercent / 100

  async function buildElement() {
    const { PayStubDocument } = await import('@/lib/pdf/payStubPdf')
    return React.createElement(PayStubDocument, {
      entry,
      company,
      startDate,
      endDate,
      lang,
      otRatePercent: payrollSettings.otRatePercent,
      holidayRatePercent: payrollSettings.holidayRatePercent,
    })
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const element = await buildElement()
      const blob = await generatePdfBlob(element)
      downloadBlob(blob, `paystub-${employee.lastName}-${startDate}.pdf`)
    } catch {
      toast({ variant: 'destructive', title: t('errors.pdfFailed') })
    } finally {
      setDownloading(false)
    }
  }

  const handleSendEmail = async () => {
    if (!employee.workEmail) {
      toast({ variant: 'destructive', title: t('payroll.soloPaystub.noEmail') })
      return
    }
    if (!emailConfig.connected || !emailConfig.resendApiKey) {
      toast({ variant: 'destructive', title: 'Email not configured. Set up in Connectors.' })
      return
    }
    setSending(true)
    try {
      const element = await buildElement()
      const blob = await generatePdfBlob(element)
      const pdfBase64 = await blobToBase64(blob)
      const fullName = `${employee.firstName} ${employee.lastName}`
      const period = `${startDate} – ${endDate}`
      const subject = emailTemplate.subject
        .replace('{name}', fullName)
        .replace('{period}', period)
        .replace('{company}', company.name)
      const body = emailTemplate.body
        .replace('{name}', fullName)
        .replace('{period}', period)
        .replace('{company}', company.name)

      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: employee.workEmail,
          subject,
          html: body.replace(/\n/g, '<br>'),
          pdfBase64,
          pdfFilename: `paystub-${startDate}.pdf`,
          provider: 'resend',
          resendApiKey: emailConfig.resendApiKey,
          fromEmail: emailConfig.fromEmail,
          fromName: emailConfig.fromName,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      toast({ variant: 'success', title: t('common.success'), description: `Sent to ${employee.workEmail}` })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('errors.sendFailed')
      toast({ variant: 'destructive', title: t('errors.sendFailed'), description: msg })
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-6">
            <span>{t('payroll.soloPaystub.title')}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Paystub preview */}
        <div className="rounded-xl border border-gray-100 overflow-hidden text-sm">

          {/* Header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-start gap-3">
              {company.logoBase64 && (
                <img
                  src={`data:image/png;base64,${company.logoBase64}`}
                  alt="logo"
                  className="h-10 w-10 rounded-lg object-contain"
                />
              )}
              <div>
                <p className="font-bold text-emerald-600 text-base">{company.name}</p>
                {company.rnc && <p className="text-xs text-gray-500">RNC: {company.rnc}</p>}
                {company.address && <p className="text-xs text-gray-500">{company.address}</p>}
                {company.phone && <p className="text-xs text-gray-500">{company.phone}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="font-extrabold text-lg tracking-widest text-gray-900">{t('payroll.soloPaystub.title').toUpperCase()}</p>
              <p className="text-xs text-gray-500 mt-1">
                <span className="font-medium text-gray-700">{t('payroll.soloPaystub.dateRange')}:</span>{' '}
                {startDate} – {endDate}
              </p>
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">{t('payroll.soloPaystub.payDate')}:</span>{' '}
                {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Employee info */}
          <div className="flex items-center gap-4 px-5 py-3 bg-gray-50 border-b border-gray-100 border-l-4 border-l-emerald-500">
            <div>
              <p className="font-bold text-gray-900">{employee.firstName} {employee.lastName}</p>
              <div className="flex gap-4 mt-0.5">
                {employee.jobTitle && (
                  <p className="text-xs text-gray-500">
                    {t('payroll.soloPaystub.title').includes('Stub') ? 'Position' : 'Cargo'}:{' '}
                    <span className="font-medium text-gray-700">{employee.jobTitle}</span>
                  </p>
                )}
                {employee.department && (
                  <p className="text-xs text-gray-500">
                    Dept: <span className="font-medium text-gray-700">{employee.department}</span>
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  ID: <span className="font-medium text-gray-700">{employee.id}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Earnings */}
          <table className="w-full">
            <thead>
              <tr className="bg-emerald-600">
                <th className="px-4 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">{t('payroll.soloPaystub.earnings')}</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-white">{t('payroll.soloPaystub.hours')}</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-white">{t('payroll.soloPaystub.rate')}</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-white">{t('payroll.soloPaystub.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {hoursEntry.regularHours > 0 && (
                <tr>
                  <td className="px-4 py-2 text-gray-700">{t('payroll.soloPaystub.regularHours')}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{hoursEntry.regularHours}</td>
                  <td className="px-3 py-2 text-right text-gray-500 text-xs">{formatCurrency(employee.payRate)}/hr</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatCurrency(calculation.regularPay)}</td>
                </tr>
              )}
              {hoursEntry.otHours > 0 && (
                <tr>
                  <td className="px-4 py-2 text-gray-700">{t('payroll.soloPaystub.overtimeHours')}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{hoursEntry.otHours}</td>
                  <td className="px-3 py-2 text-right text-gray-500 text-xs">{formatCurrency(employee.payRate)}/hr × {otMultiplier.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatCurrency(calculation.otPay)}</td>
                </tr>
              )}
              {hoursEntry.holidayHours > 0 && (
                <tr>
                  <td className="px-4 py-2 text-gray-700">{t('payroll.soloPaystub.holidayHours')}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{hoursEntry.holidayHours}</td>
                  <td className="px-3 py-2 text-right text-gray-500 text-xs">{formatCurrency(employee.payRate)}/hr × {holidayMultiplier.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatCurrency(calculation.holidayPay)}</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={3} className="px-4 py-2.5 font-bold text-gray-900">{t('payroll.soloPaystub.grossTotal')}</td>
                <td className="px-4 py-2.5 text-right font-bold text-emerald-700 text-base">{formatCurrency(calculation.grossPay)}</td>
              </tr>
            </tfoot>
          </table>

          {/* Deductions */}
          <table className="w-full mt-4">
            <thead>
              <tr className="bg-gray-700">
                <th className="px-4 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">{t('payroll.soloPaystub.deductions')}</th>
                <th className="px-3 py-2 text-center text-xs font-bold text-white">{t('payroll.soloPaystub.rate')}</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-white">{t('payroll.soloPaystub.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <tr>
                <td className="px-4 py-2 text-gray-700">{t('payroll.soloPaystub.sfs')}</td>
                <td className="px-3 py-2 text-center text-gray-500 text-xs">3.04%</td>
                <td className="px-4 py-2 text-right text-red-600 font-semibold">({formatCurrency(calculation.sfsAmount)})</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-gray-700">{t('payroll.soloPaystub.afp')}</td>
                <td className="px-3 py-2 text-center text-gray-500 text-xs">2.87%</td>
                <td className="px-4 py-2 text-right text-red-600 font-semibold">({formatCurrency(calculation.afpAmount)})</td>
              </tr>
              {calculation.customDeductionsBreakdown.map((d) => (
                <tr key={d.name}>
                  <td className="px-4 py-2 text-gray-700">{d.name}</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-4 py-2 text-right text-red-600 font-semibold">({formatCurrency(d.amount)})</td>
                </tr>
              ))}
              <tr>
                <td className="px-4 py-2 text-gray-700">{t('payroll.soloPaystub.isr')}</td>
                <td className="px-3 py-2"></td>
                <td className="px-4 py-2 text-right text-red-600 font-semibold">({formatCurrency(calculation.isrPeriod)})</td>
              </tr>
              <tr className="bg-gray-50">
                <td className="px-4 py-2 text-gray-600 text-xs">{t('payroll.soloPaystub.isrSalary')}</td>
                <td className="px-3 py-2"></td>
                <td className="px-4 py-2 text-right text-gray-700 text-xs font-semibold">{formatCurrency(isrMonthlySalary)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={2} className="px-4 py-2.5 font-bold text-gray-900">{t('payroll.soloPaystub.totalDeductions')}</td>
                <td className="px-4 py-2.5 text-right font-bold text-red-600">({formatCurrency(calculation.totalDeductions)})</td>
              </tr>
            </tfoot>
          </table>

          {/* Net Income */}
          <div className="flex items-center justify-between px-5 py-4 bg-emerald-50 border border-emerald-200 mx-3 my-3 rounded-xl">
            <span className="font-extrabold text-emerald-800 text-base">{t('payroll.soloPaystub.netIncome')}</span>
            <span className="font-extrabold text-emerald-600 text-2xl">{formatCurrency(calculation.netPay)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X className="h-4 w-4" />
            {t('payroll.soloPaystub.close')}
          </Button>
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={downloading}
            className="gap-2"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t('payroll.soloPaystub.download')}
          </Button>
          <Button
            onClick={handleSendEmail}
            disabled={sending || !employee.workEmail}
            className="gap-2"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {sending ? t('payroll.soloPaystub.sending') : t('payroll.soloPaystub.sendEmail')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
