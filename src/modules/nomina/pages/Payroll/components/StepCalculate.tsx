import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Calculator } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { UsdAmount } from '@/shared/components/UsdAmount'
import { useEmployeesStore } from '@/shared/store/employeesStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { usePayrollStore } from '@/shared/store/payrollStore'
import { usePendingVacationIsrStore } from '@/shared/store/pendingVacationIsrStore'
import { usePayrollSettingsStore } from '@/shared/store/payrollSettingsStore'
import { useCountryFiscalStore } from '@/shared/store/countryFiscalStore'
import { calculatePayroll, findFirstFortnightGross } from '@/modules/nomina/lib/payroll/calculations'
import { getPayrollRules } from '@/modules/nomina/lib/payroll/rules'
import { getInitials } from '@/shared/lib/utils'
import { formatCurrency } from '@/shared/lib/utils/currency'
import { countryFlag } from '@/shared/lib/utils/countryFlag'
import { roundHalfUp } from '@/modules/nomina/lib/payroll/calculations'
import type { EmployeeHoursEntry, PayrollEntry, PayrollTotals } from '@/shared/types'

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
  const payrollOverrides = usePayrollSettingsStore((s) => s.byId)
  const countryConfigs = useCountryFiscalStore((s) => s.byCountry)

  // Global run = all countries in one pass; each employee is calculated with its
  // OWN country's tax rules.
  const isGlobal = country === 'Global'

  // Build country-specific payroll rules (the selected country in single mode).
  const rules = useMemo(
    () => getPayrollRules(country, frequency, fiscal, payrollSettings, countryConfigs),
    [country, frequency, fiscal, payrollSettings, countryConfigs],
  )

  // For UI banners only — actual quincena logic is inside calculatePayroll
  const isDR = !isGlobal && rules.country.toLowerCase().includes('dominican')
  const isUS = !isGlobal && (rules.country.toLowerCase().includes('united states') || rules.country.toLowerCase() === 'us')
  const isGenericCountry = !isGlobal && !isDR && !isUS && rules.country !== 'Unknown' && rules.country !== ''
  const firstQuincena = isDR && frequency === 'biweekly' && isFirstQuincena(startDate)

  const { entries, totals } = useMemo(() => {
    const computedEntries: PayrollEntry[] = []
    // Cache rules per country so a Global run builds each country's ruleset once.
    const rulesByCountry = new Map<string, ReturnType<typeof getPayrollRules>>()
    const rulesFor = (c: string) => {
      const key = c || 'Unknown'
      let r = rulesByCountry.get(key)
      if (!r) { r = getPayrollRules(key, frequency, fiscal, payrollSettings, countryConfigs); rulesByCountry.set(key, r) }
      return r
    }

    for (const h of employeeHours) {
      const emp = employees.find((e) => e.id === h.employeeId)
      if (!emp) continue
      // Inactive employees are excluded from the entire run: calculation, totals,
      // paystubs and reports/exports all derive from `entries` built here.
      if (emp.payroll_active === false) continue

      const empCountry = emp.country?.trim() || (isGlobal ? 'Unknown' : country)
      const empRules = isGlobal ? rulesFor(empCountry) : rules

      const calculation = calculatePayroll({
        employeeId: emp.id,
        payType: emp.payType,
        hourlyRate: h.payRateOverride ?? emp.payRate,
        regularHours: h.regularHours,
        otHours: h.otHours,
        holidayHours: h.holidayHours,
        customDeductions: emp.customDeductions?.filter((d) => d.active) ?? [],
        rules: empRules,
        frequency,
        otRatePercent: payrollSettings.otRatePercent,
        holidayRatePercent: payrollSettings.holidayRatePercent,
        periodStart: startDate,
        periodEnd: endDate,
        firstFortnightGross: findFirstFortnightGross(history, empCountry, startDate, emp.id),
        nightHours: h.nightHours,
        nightShift,
        pendingVacationIsr: (() => {
          const p = pendingVacationIsr[emp.id]
          return p && p.appliedInPeriod === null ? p.amount : 0
        })(),
        taxExempt: payrollOverrides[emp.id]?.taxExempt === true,
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
  }, [employeeHours, employees, rules, isGlobal, fiscal, frequency, payrollSettings, startDate, endDate, country, history, nightShift, pendingVacationIsr, payrollOverrides, countryConfigs])

  // Per-country rollup for Global mode (native currencies, no conversion).
  const byCountry = useMemo(() => {
    const map = new Map<string, { country: string; count: number; gross: number; net: number }>()
    for (const e of entries) {
      const c = e.employee.country?.trim() || 'Unknown'
      const agg = map.get(c) ?? { country: c, count: 0, gross: 0, net: 0 }
      agg.count++
      agg.gross += e.calculation.grossPay
      agg.net += e.calculation.netPay
      map.set(c, agg)
    }
    return [...map.values()].map((a) => ({ ...a, gross: roundHalfUp(a.gross), net: roundHalfUp(a.net) }))
  }, [entries])

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

      {/* Summary — per-country in Global mode (native currencies, no conversion) */}
      {isGlobal ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            🌎 {t('payroll.global')} — {entries.length} {t('common.employees')} · {byCountry.length} {t('payroll.countries')}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byCountry.map((c) => (
              <div key={c.country} className="rounded-xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <span>{countryFlag(c.country)}</span> {c.country}
                  <span className="ml-auto text-xs font-normal text-muted-foreground">{c.count} {t('common.employees')}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">{t('payroll.calculate.grossPay')}</p>
                    <p className="text-figure font-bold text-foreground">{formatCurrency(c.gross, c.country)}</p>
                    <UsdAmount amount={c.gross} country={c.country} className="block" />
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('payroll.calculate.netPay')}</p>
                    <p className="text-figure font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(c.net, c.country)}</p>
                    <UsdAmount amount={c.net} country={c.country} className="block" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label={t('payroll.calculate.grossPay')} value={formatCurrency(totals.totalGross, country)} color="text-foreground" subAmount={totals.totalGross} subCountry={country} />
          <SummaryCard label={t('payroll.calculate.tss')} value={formatCurrency(totals.totalTss, country)} color="text-orange-600" subAmount={totals.totalTss} subCountry={country} />
          <SummaryCard label={t('payroll.calculate.isr')} value={formatCurrency(totals.totalIsr, country)} color="text-red-600" subAmount={totals.totalIsr} subCountry={country} />
          <SummaryCard label={t('payroll.calculate.netPay')} value={formatCurrency(totals.totalNet, country)} color="text-emerald-700" highlight subAmount={totals.totalNet} subCountry={country} />
        </div>
      )}

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
                  {isGlobal && (
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('payroll.country')}
                    </th>
                  )}
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
                {entries.map(({ employee: emp, calculation: c }) => {
                  const ec = emp.country?.trim() || country
                  return (
                  <tr key={emp.id} className="hover:bg-secondary">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                          {getInitials(emp.firstName, emp.lastName)}
                        </div>
                        <span className="font-medium text-foreground text-xs">
                          {emp.firstName} {emp.lastName}
                        </span>
                      </div>
                    </td>
                    {isGlobal && (
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <span className="mr-1">{countryFlag(ec)}</span>{ec}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right text-foreground">{formatCurrency(c.grossPay, ec)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(c.afpAmount, ec)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(c.sfsAmount, ec)}</td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {firstQuincena
                        ? <span className="text-muted-foreground italic">{formatCurrency(0, ec)}</span>
                        : formatCurrency(c.isrPeriod, ec)
                      }
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(c.customDeductions, ec)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {formatCurrency(c.netPay, ec)}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
              {/* Single-currency grand total — hidden in Global (use per-country summary above) */}
              {!isGlobal && (
                <tfoot>
                  <tr className="border-t-2 border-input bg-secondary font-semibold">
                    <td className="px-5 py-3 text-xs uppercase text-muted-foreground">{t('payroll.calculate.totals')}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(totals.totalGross, country)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(totals.totalAfp, country)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{formatCurrency(totals.totalSfs, country)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(totals.totalIsr, country)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(totals.totalCustomDeductions, country)}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {formatCurrency(totals.totalNet, country)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom action buttons */}
      <ActionButtons />
    </div>
  )
}

function SummaryCard({ label, value, color, highlight, subAmount, subCountry }: { label: string; value: string; color: string; highlight?: boolean; subAmount?: number; subCountry?: string }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'border-emerald-200 bg-emerald-50' : 'border-border bg-card'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${color}`}>{value}</p>
      {subAmount !== undefined && <UsdAmount amount={subAmount} country={subCountry} className="mt-0.5 block" />}
    </div>
  )
}
