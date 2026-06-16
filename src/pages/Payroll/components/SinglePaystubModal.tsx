import { useState, useMemo } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Mail, Loader2, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useSettingsStore } from '@/store/settingsStore'
import { usePayrollStore } from '@/store/payrollStore'
import { calculatePayroll, formatCurrencyWithSymbol, findFirstFortnightGross } from '@/lib/payroll/calculations'
import { getPayrollRules } from '@/lib/payroll/rules'
import { generatePdfBlob, downloadBlob, blobToBase64 } from '@/lib/pdf/generatePdf'
import { logoSrc } from '@/lib/pdf/logo'
import { toast } from '@/hooks/useToast'
import type { Employee, EmployeeHoursEntry } from '@/types'

interface Props {
  employee: Employee
  hoursEntry: EmployeeHoursEntry
  startDate: string
  endDate: string
  frequency: 'biweekly' | 'weekly'
  country: string
  onClose: () => void
}

// Lookup a deduction from the breakdown by keyword match.
function lookupDed(
  breakdown: Array<{ name: string; amount: number }>,
  keywords: string[],
): number {
  const found = breakdown.find((d) =>
    keywords.some((kw) => d.name.toLowerCase().includes(kw.toLowerCase())),
  )
  return found?.amount ?? 0
}

function otherDeds(
  breakdown: Array<{ name: string; amount: number }>,
): Array<{ name: string; amount: number }> {
  const fixed = ['advance', 'adelanto', 'dependent tss', 'tss depend', 'complementary', 'complementario']
  return breakdown.filter(
    (d) => !fixed.some((kw) => d.name.toLowerCase().includes(kw)),
  )
}

export function SinglePaystubModal({ employee, hoursEntry, startDate, endDate, frequency, country, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const company = useSettingsStore((s) => s.company)
  const fiscal = useSettingsStore((s) => s.fiscal)
  const payrollSettings = useSettingsStore((s) => s.payroll)
  const emailConfig = useSettingsStore((s) => s.email)
  const emailTemplate = useSettingsStore((s) => s.emailTemplate)
  const history = usePayrollStore((s) => s.history)
  const lang = (i18n.language?.startsWith('es') ? 'es' : 'en') as 'en' | 'es'

  const [downloading, setDownloading] = useState(false)
  const [sending, setSending] = useState(false)

  const rules = useMemo(
    () => getPayrollRules(country, frequency, fiscal, payrollSettings),
    [country, frequency, fiscal, payrollSettings],
  )

  // Admin-entered rate (for "Not set" employees) takes precedence over BambooHR rate
  const effectiveRate = hoursEntry.payRateOverride ?? employee.payRate

  // Format money with the employee's country currency symbol
  const fmt = (n: number) => formatCurrencyWithSymbol(n, rules.currencySymbol)

  const calculation = useMemo(() => calculatePayroll({
    employeeId: employee.id,
    payType: employee.payType,
    hourlyRate: effectiveRate,
    regularHours: hoursEntry.regularHours,
    otHours: hoursEntry.otHours,
    holidayHours: hoursEntry.holidayHours,
    customDeductions: employee.customDeductions?.filter((d) => d.active) ?? [],
    rules,
    frequency,
    otRatePercent: payrollSettings.otRatePercent,
    holidayRatePercent: payrollSettings.holidayRatePercent,
    periodStart: startDate,
    firstFortnightGross: findFirstFortnightGross(history, country, startDate, employee.id),
  }), [employee, effectiveRate, hoursEntry, rules, payrollSettings, frequency, startDate, country, history])

  const entry = useMemo(() => ({
    employee,
    hours: hoursEntry,
    calculation,
  }), [employee, hoursEntry, calculation])

  // Rate shown in the earnings table. For Salary, the per-hour figure is gross ÷ period
  // hours (pay is fixed), so hours × rate = gross stays consistent. Hourly shows its rate.
  const displayRate = employee.payType === 'Salary'
    ? (hoursEntry.regularHours > 0 ? calculation.regularPay / hoursEntry.regularHours : 0)
    : effectiveRate

  const otMultiplier = 1 + payrollSettings.otRatePercent / 100

  // Fixed deduction values
  const payAdvanceAmt    = lookupDed(calculation.customDeductionsBreakdown, ['advance', 'adelanto'])
  const dependentTSSAmt  = lookupDed(calculation.customDeductionsBreakdown, ['dependent tss', 'tss depend', 'depend'])
  const complementaryAmt = lookupDed(calculation.customDeductionsBreakdown, ['complementary', 'complementario'])
  const remainingDeds    = otherDeds(calculation.customDeductionsBreakdown)

  // "Salary for the month applicable to ISR" = monthly net base (net 1st + net 2nd fortnight)
  const isrSalaryDisplay = calculation.isrMonthlyBase

  async function buildElement() {
    const { PayStubDocument } = await import('@/lib/pdf/payStubPdf')
    return React.createElement(PayStubDocument, {
      entry,
      company,
      startDate,
      endDate,
      lang,
      country,
      otRatePercent: payrollSettings.otRatePercent,
      holidayRatePercent: payrollSettings.holidayRatePercent,
    })
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const element = await buildElement()
      const blob = await generatePdfBlob(element)
      const fname = `Paystub_${employee.firstName}_${employee.lastName}_${startDate}_${endDate}.pdf`
      downloadBlob(blob, fname)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[Paystub] download failed:', err)
      toast({ variant: 'destructive', title: t('errors.pdfFailed'), description: msg })
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
        .replace('{name}', fullName).replace('{period}', period).replace('{company}', company.name)
      const body = emailTemplate.body
        .replace('{name}', fullName).replace('{period}', period).replace('{company}', company.name)

      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: employee.workEmail,
          subject,
          html: body.replace(/\n/g, '<br>'),
          pdfBase64,
          pdfFilename: `Paystub_${employee.firstName}_${employee.lastName}_${startDate}_${endDate}.pdf`,
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
          <DialogTitle className="pr-6">{t('payroll.soloPaystub.title')}</DialogTitle>
        </DialogHeader>

        {/* Paystub preview */}
        <div className="rounded-xl border border-gray-100 overflow-hidden text-sm">

          {/* Header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-start gap-3">
              {logoSrc(company.logoBase64) && (
                <img
                  src={logoSrc(company.logoBase64)}
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
              <p className="font-extrabold text-lg tracking-widest text-gray-900">PAYSTUB</p>
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
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 border-l-4 border-l-emerald-500">
            <p className="font-bold text-gray-900">{employee.firstName} {employee.lastName}</p>
            <div className="flex flex-wrap gap-4 mt-1">
              {employee.jobTitle && (
                <p className="text-xs text-gray-500">
                  Position: <span className="font-medium text-gray-700">{employee.jobTitle}</span>
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

          {/* EARNINGS table */}
          <table className="w-full">
            <thead>
              <tr className="bg-emerald-600">
                <th className="px-4 py-2 text-left text-xs font-bold text-white">PAYMENT DESCRIPTION</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-white">HOURS</th>
                <th className="px-3 py-2 text-right text-xs font-bold text-white">RATE</th>
                <th className="px-4 py-2 text-right text-xs font-bold text-white">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {/* Regular hours - always shown */}
              <tr>
                <td className="px-4 py-2 text-gray-700">{t('payroll.soloPaystub.regularHours')}</td>
                <td className="px-3 py-2 text-right text-gray-700">{hoursEntry.regularHours}</td>
                <td className="px-3 py-2 text-right text-gray-500 text-xs">{fmt(displayRate)}/hr</td>
                <td className="px-4 py-2 text-right font-semibold">{fmt(calculation.regularPay)}</td>
              </tr>
              {/* Night incentive - always shown (default 0) */}
              <tr>
                <td className="px-4 py-2 text-gray-700">{t('payroll.soloPaystub.nightIncentive')}</td>
                <td className="px-3 py-2 text-right text-gray-700">0</td>
                <td className="px-3 py-2 text-right text-gray-500 text-xs">15%</td>
                <td className="px-4 py-2 text-right font-semibold">{fmt(0)}</td>
              </tr>
              {/* Double Holiday hours - always shown */}
              <tr>
                <td className="px-4 py-2 text-gray-700">{t('payroll.soloPaystub.holidayHours')}</td>
                <td className="px-3 py-2 text-right text-gray-700">{hoursEntry.holidayHours}</td>
                <td className="px-3 py-2 text-right text-gray-500 text-xs">{fmt(displayRate)}/hr</td>
                <td className="px-4 py-2 text-right font-semibold">{fmt(calculation.holidayPay)}</td>
              </tr>
              {/* Overtime - always shown */}
              <tr>
                <td className="px-4 py-2 text-gray-700">{t('payroll.soloPaystub.overtimeHours')}</td>
                <td className="px-3 py-2 text-right text-gray-700">{hoursEntry.otHours}</td>
                <td className="px-3 py-2 text-right text-gray-500 text-xs">{fmt(displayRate)}/hr × {otMultiplier.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-semibold">{fmt(calculation.otPay)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={3} className="px-4 py-2.5 font-bold text-gray-900">{t('payroll.soloPaystub.grossTotal')}</td>
                <td className="px-4 py-2.5 text-right font-bold text-emerald-700 text-base">{fmt(calculation.grossPay)}</td>
              </tr>
            </tfoot>
          </table>

          {/* DEDUCTIONS table */}
          <table className="w-full mt-3">
            <thead>
              <tr className="bg-gray-700">
                <th className="px-4 py-2 text-left text-xs font-bold text-white">DEDUCTIONS</th>
                <th className="px-3 py-2 text-center text-xs font-bold text-white">RATE</th>
                <th className="w-6 py-2 text-center text-xs font-bold text-white" />
                <th className="px-4 py-2 text-right text-xs font-bold text-white">TOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <DedRow fmt={fmt} label={t('payroll.soloPaystub.sfs')} rate="3.04%" amount={calculation.sfsAmount} />
              <DedRow fmt={fmt} label={t('payroll.soloPaystub.afp')} rate="2.87%" amount={calculation.afpAmount} />
              <DedRow fmt={fmt} label={t('payroll.soloPaystub.payAdvance')} amount={payAdvanceAmt} />
              <DedRow fmt={fmt} label={t('payroll.soloPaystub.dependentTSS')} amount={dependentTSSAmt} />
              {/* ISR — single line with the month's retained ISR. Hidden on the DR 1st
                  quincena, where ISR is deferred to the 2nd fortnight. */}
              {!calculation.isrDeferred && (
                <>
                  <DedRow fmt={fmt} label={t('payroll.soloPaystub.isr')} amount={calculation.isrPeriod} />
                  {/* Salary for the month applicable to ISR — neutral reference row */}
                  <tr className="bg-gray-50">
                    <td className="px-4 py-2 text-gray-500 text-xs">{t('payroll.soloPaystub.isrSalary')}</td>
                    <td className="px-3 py-2" />
                    <td className="w-6 py-2 text-center text-gray-400 text-xs">►</td>
                    <td className="px-4 py-2 text-right text-gray-700 text-xs font-semibold">{fmt(isrSalaryDisplay)}</td>
                  </tr>
                </>
              )}
              <DedRow fmt={fmt} label={t('payroll.soloPaystub.complementaryIns')} amount={complementaryAmt} />
              {remainingDeds.map((d) => (
                <DedRow fmt={fmt} key={d.name} label={d.name} amount={d.amount} />
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={3} className="px-4 py-2.5 font-bold text-gray-900">{t('payroll.soloPaystub.totalDeductions')}</td>
                <td className="px-4 py-2.5 text-right font-bold text-red-600">({fmt(calculation.totalDeductions)})</td>
              </tr>
            </tfoot>
          </table>

          {/* NET INCOME */}
          <div className="flex items-center justify-between px-5 py-4 bg-emerald-50 border border-emerald-200 mx-3 my-3 rounded-xl">
            <span className="font-extrabold text-emerald-800 text-base">{t('payroll.soloPaystub.netIncome')}</span>
            <span className="font-extrabold text-emerald-600 text-2xl">{fmt(calculation.netPay)}</span>
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

function DedRow({ label, rate, amount, fmt }: { label: string; rate?: string; amount: number; fmt: (n: number) => string }) {
  return (
    <tr>
      <td className="px-4 py-2 text-gray-700">{label}</td>
      <td className="px-3 py-2 text-center text-gray-500 text-xs">{rate ?? ''}</td>
      <td className="w-6 py-2 text-center text-gray-400 text-xs">►</td>
      <td className="px-4 py-2 text-right text-red-600 font-semibold">{fmt(amount)}</td>
    </tr>
  )
}
