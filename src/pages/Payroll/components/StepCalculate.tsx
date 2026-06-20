import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Calculator } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useEmployeesStore } from '@/store/employeesStore'
import { useSettingsStore } from '@/store/settingsStore'
import { usePayrollStore } from '@/store/payrollStore'
import { usePendingVacationIsrStore } from '@/store/pendingVacationIsrStore'
import { calculatePayroll, findFirstFortnightGross } from '@/lib/payroll/calculations'
import { getPayrollRules } from '@/lib/payroll/rules'
import { formatCurrency, getInitials } from '@/lib/utils'
import { roundHalfUp } from '@/lib/payroll/calculations'
import type { EmployeeHoursEntry, PayrollEntry, PayrollTotals } from '@/types'

interface Props {
  employeeHours: EmployeeHoursEntry[]
  startDate: string
  endDate: string
  frequency: 'biweekly' | 'weekly' | 'full_month'
  country: string
  onNext: (entries: PayrollEntry[], totals: PayrollTotals) => void
  onBack: () => void
}

// For the UI notice banners only — does not affect the calculation.
function isFirstQuincena(startDate: string): boolean {
  return new Date(startDate + 'T00:00:00').getDate() <= 15
}

export function StepCalculate({ employeeHours, startDate, endDate, frequency, country, onNext, onBack }: Props) {
  const { t } = useTranslation()
  const employees = useEmployeesStore((s) => s.employees)
  const fiscal = useSettingsStore((s) => s.fiscal)
  const payrollSettings = useSettingsStore((s) => s.payroll)
  const nightShift = useSettingsStore((s) => s.nightShift)
  const history = usePayrollStore((s) => s.history)
  const pendingVacationIsr = usePendingVacationIsrStore((s) => s.pending)

  // Build country-specific payroll rules
  const rules = useMemo(
    () => getPayrollRules(country, frequency, fiscal, payrollSettings),
    [country, frequency, fiscal, payrollSettings],
  )

  // For UI banners only — actual quincena logic is inside calculatePayroll
  const isDR = rules.country.toLowerCase().includes('dominican')
  const isUS = rules.country.toLowerCase().includes('united states') || rules.country.toLowerCase() === 'us'
  const isGenericCountry = !isDR && !isUS && rules.country !== 'Unknown' && rules.country !== ''
  const firstQuincena = isDR && frequency === 'biweekly' && isFirstQuincena(startDate)

  const { entries, totals } = useMemo(() => {
    const computedEntries: PayrollEntry[] = []

    for (const h of employeeHours) {
      const emp = employees.find((e) => e.id === h.employeeId)
      if (!emp) continue

      const calculation = calculatePayroll({
        employeeId: emp.id,
        payType: emp.payType,
        hourlyRate: h.payRateOverride ?? emp.payRate,
        regularHours: h.regularHours,
        otHours: h.otHours,
        holidayHours: h.holidayHours,
        customDeductions: emp.customDeductions?.filter((d) => d.active) ?? [],
        rules,
        frequency,
        otRatePercent: payrollSettings.otRatePercent,
        holidayRatePercent: payrollSettings.holidayRatePercent,
        periodStart: startDate,
        periodEnd: endDate,
        firstFortnightGross: findFirstFortnightGross(history, country, startDate, emp.id),
        nightHours: h.nightHours,
        nightShift,
        pendingVacationIsr: (() => {
          const p = pendingVacationIsr[emp.id]
          return p && p.appliedInPeriod === null ? p.amount : 0
        })(),
      })

      computedEntries.push({ employee: emp, hours: h, calculation })
    }

    const totals: PayrollTotals = {
      totalGross: roundHalfUp(computedEntries.reduce((s, e) => s + e.calculation.grossPay, 0)),
      totalAfp: roundHalfUp(computedEntries.reduce((s, e) => s + e.calculation.afpAmount, 0)),
      totalSfs: roundHalfUp(computedEntries.reduce((s, e) => s + e.calculation.sfsAmount, 0)),
      totalTss: roundHalfUp(computedEntries.reduce((s, e) => s + e.calculation.tssTotal, 0)),
      totalIsr: roundHalfUp(computedEntries.reduce((s, e) => s + e.calculation.isrPeriod, 0)),
      totalCustomDeductions: roundHalfUp(computedEntries.reduce((s, e) => s + e.calculation.customDeductions, 0)),
      totalDeductions: roundHalfUp(computedEntries.reduce((s, e) => s + e.calculation.totalDeductions, 0)),
      totalNet: roundHalfUp(computedEntries.reduce((s, e) => s + e.calculation.netPay, 0)),
      employeeCount: computedEntries.length,
    }

    return { entries: computedEntries, totals }
  }, [employeeHours, employees, rules, frequency, payrollSettings, startDate, endDate, country, history, nightShift, pendingVacationIsr])

  const ActionButtons = () => (
    <div className="flex gap-3">
      <Button variant="outline" onClick={onBack}>{t('common.back')}</Button>
      <Button onClick={() => onNext(entries, totals)}>
        {t('payroll.approve.approve')}
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Top action buttons */}
      <ActionButtons />

      {/* Generic country notice — no tax rules configured */}
      {isGenericCountry && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          {t('payroll.calculate.genericCountryNotice', { country: rules.country })}
        </div>
      )}

      {/* Quincena ISR notice — only for DR */}
      {isDR && frequency === 'biweekly' && firstQuincena && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
          {t('payroll.calculate.quincena1Notice')}
        </div>
      )}
      {isDR && frequency === 'biweekly' && !firstQuincena && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          {t('payroll.calculate.quincena2Notice')}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label={t('payroll.calculate.grossPay')} value={formatCurrency(totals.totalGross)} color="text-foreground" />
        <SummaryCard label={t('payroll.calculate.tss')} value={formatCurrency(totals.totalTss)} color="text-orange-600" />
        <SummaryCard label={t('payroll.calculate.isr')} value={formatCurrency(totals.totalIsr)} color="text-red-600" />
        <SummaryCard label={t('payroll.calculate.netPay')} value={formatCurrency(totals.totalNet)} color="text-emerald-700" highlight />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <Calculator className="h-5 w-5 text-emerald-600" />
            </div>
            <CardTitle>{t('payroll.calculate.title')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.calculate.employee')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.calculate.grossPay')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.calculate.afp')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.calculate.sfs')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.calculate.isr')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.calculate.otherDeductions')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-emerald-50">
                    {t('payroll.calculate.netPay')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map(({ employee: emp, calculation: c }) => (
                  <tr key={emp.id} className="hover:bg-secondary">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                          {getInitials(emp.firstName, emp.lastName)}
                        </div>
                        <span className="font-medium text-foreground text-xs">
                          {emp.firstName} {emp.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground">{formatCurrency(c.grossPay)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(c.afpAmount)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(c.sfsAmount)}</td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {firstQuincena
                        ? <span className="text-muted-foreground italic">{formatCurrency(0)}</span>
                        : formatCurrency(c.isrPeriod)
                      }
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(c.customDeductions)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 bg-emerald-50">
                      {formatCurrency(c.netPay)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-input bg-secondary font-semibold">
                  <td className="px-5 py-3 text-xs uppercase text-muted-foreground">{t('payroll.calculate.totals')}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totals.totalGross)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(totals.totalAfp)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(totals.totalSfs)}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatCurrency(totals.totalIsr)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(totals.totalCustomDeductions)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 bg-emerald-50">
                    {formatCurrency(totals.totalNet)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom action buttons */}
      <ActionButtons />
    </div>
  )
}

function SummaryCard({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-card'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}
