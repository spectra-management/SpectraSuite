import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Calculator } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useEmployeesStore } from '@/store/employeesStore'
import { useSettingsStore } from '@/store/settingsStore'
import { calculatePayroll } from '@/lib/payroll/calculations'
import { formatCurrency, getInitials } from '@/lib/utils'
import type { EmployeeHoursEntry, PayrollEntry, PayrollTotals } from '@/types'
import { roundHalfUp } from '@/lib/payroll/calculations'

interface Props {
  employeeHours: EmployeeHoursEntry[]
  frequency: 'biweekly' | 'weekly'
  onNext: (entries: PayrollEntry[], totals: PayrollTotals) => void
  onBack: () => void
}

export function StepCalculate({ employeeHours, frequency, onNext, onBack }: Props) {
  const { t } = useTranslation()
  const employees = useEmployeesStore((s) => s.employees)
  const fiscal = useSettingsStore((s) => s.fiscal)
  const payrollSettings = useSettingsStore((s) => s.payroll)

  const { entries, totals } = useMemo(() => {
    const computedEntries: PayrollEntry[] = []

    for (const h of employeeHours) {
      const emp = employees.find((e) => e.id === h.employeeId)
      if (!emp) continue

      const calculation = calculatePayroll({
        employeeId: emp.id,
        hourlyRate: emp.payRate,
        regularHours: h.regularHours,
        otHours: h.otHours,
        holidayHours: h.holidayHours,
        customDeductions: emp.customDeductions?.filter((d) => d.active) ?? [],
        fiscal,
        payroll: payrollSettings,
        frequency,
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
  }, [employeeHours, employees, fiscal, payrollSettings, frequency])

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label={t('payroll.calculate.grossPay')} value={formatCurrency(totals.totalGross)} color="text-gray-900" />
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
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.calculate.employee')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.calculate.grossPay')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.calculate.afp')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.calculate.sfs')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.calculate.isr')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.calculate.otherDeductions')}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 bg-emerald-50">
                    {t('payroll.calculate.netPay')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {entries.map(({ employee: emp, calculation: c }) => (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                          {getInitials(emp.firstName, emp.lastName)}
                        </div>
                        <span className="font-medium text-gray-900 text-xs">
                          {emp.firstName} {emp.lastName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(c.grossPay)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(c.afpAmount)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(c.sfsAmount)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(c.isrPeriod)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(c.customDeductions)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 bg-emerald-50">
                      {formatCurrency(c.netPay)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                  <td className="px-5 py-3 text-xs uppercase text-gray-500">{t('payroll.calculate.totals')}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(totals.totalGross)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(totals.totalAfp)}</td>
                  <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(totals.totalSfs)}</td>
                  <td className="px-4 py-3 text-right text-red-600">{formatCurrency(totals.totalIsr)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(totals.totalCustomDeductions)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 bg-emerald-50">
                    {formatCurrency(totals.totalNet)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>{t('common.back')}</Button>
        <Button onClick={() => onNext(entries, totals)}>
          {t('payroll.approve.approve')}
        </Button>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-emerald-200 bg-emerald-50' : 'border-gray-100 bg-white'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}
