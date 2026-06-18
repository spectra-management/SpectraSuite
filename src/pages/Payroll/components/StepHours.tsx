import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Pencil, CheckCircle2, AlertTriangle, MapPin, CalendarDays, Calculator, Search, Banknote, Landmark, ScrollText, Palmtree, Coins } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useEmployeesStore } from '@/store/employeesStore'
import { usePaymentMethodsStore } from '@/store/paymentMethodsStore'
import { useBankAccountsStore } from '@/store/bankAccountsStore'
import { useSettingsStore } from '@/store/settingsStore'
import { usePendingVacationIsrStore } from '@/store/pendingVacationIsrStore'
import { formatCurrency, formatDate, getInitials, maskAccount } from '@/lib/utils'
import { roundHalfUp, formatCurrencyWithSymbol } from '@/lib/payroll/calculations'
import { getCurrencySymbol } from '@/lib/payroll/rules'
import { getHolidaysInRange } from '@/lib/holidays'
import { calculateVacationPay, yearsOfService } from '@/lib/vacations'
import { fetchVacations, getVacationsForEmployee, getVacationsOverlappingPeriod, type VacationRequest } from '@/lib/connectors/bamboohr-vacations'
import { PAYMENT_METHOD_LABELS } from '@/lib/pdf/paystubLabels'
import { SinglePaystubModal } from './SinglePaystubModal'
import type { EmployeeHoursEntry, Employee, PaymentMethod } from '@/types'

const PAYMENT_ICON: Record<PaymentMethod, typeof Banknote> = {
  cash: Banknote,
  transfer: Landmark,
  check: ScrollText,
}

type Filter = 'all' | 'with-hours' | 'zero-hours' | 'no-match' | 'ot'

interface Props {
  employeeHours: EmployeeHoursEntry[]
  startDate: string
  endDate: string
  frequency: 'biweekly' | 'weekly'
  country: string
  onNext: (hours: EmployeeHoursEntry[]) => void
  onBack: () => void
}

function totalHours(h: EmployeeHoursEntry) {
  return roundHalfUp(h.regularHours + h.otHours + h.holidayHours, 2)
}

interface SoloTarget {
  employee: Employee
  hoursEntry: EmployeeHoursEntry
}

function countryFlag(country: string): string {
  const c = country.toLowerCase().trim()
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

export function StepHours({ employeeHours, startDate, endDate, frequency, country, onNext, onBack }: Props) {
  const { t, i18n } = useTranslation()
  const employees = useEmployeesStore((s) => s.employees)
  const paymentMethods = usePaymentMethodsStore((s) => s.methods)
  const bankAccounts = useBankAccountsStore((s) => s.accounts)
  const bamboo = useSettingsStore((s) => s.bamboohr)
  const pendingVacationIsr = usePendingVacationIsrStore((s) => s.pending)
  const uiLang = i18n.language?.startsWith('es') ? 'es' : 'en'
  // Pending vacation ISR is collected on the 2nd fortnight (period start day ≥ 16).
  const isSecondFortnight = frequency === 'biweekly' && new Date(startDate + 'T00:00:00').getDate() > 15

  // Pending vacation ISR tooltip for an employee (2nd fortnight only).
  const pendingIsrInfo = (emp: Employee): string | null => {
    if (!isSecondFortnight) return null
    const rec = pendingVacationIsr[emp.id]
    if (!rec || rec.appliedInPeriod !== null || rec.amount <= 0) return null
    return t('payroll.review.pendingVacationIsr', { amount: formatCurrencyWithSymbol(rec.amount, getCurrencySymbol(country)) })
  }

  // Approved vacations for the pay-period year (for the 🌴 overlap badge).
  const [vacations, setVacations] = useState<VacationRequest[]>([])
  useEffect(() => {
    if (!bamboo.connected || !bamboo.subdomain || !bamboo.apiKey || !startDate) return
    let cancelled = false
    fetchVacations(bamboo.subdomain, bamboo.apiKey, Number(startDate.slice(0, 4)))
      .then((all) => { if (!cancelled) setVacations(all) })
      .catch(() => { if (!cancelled) setVacations([]) })
    return () => { cancelled = true }
  }, [bamboo.connected, bamboo.subdomain, bamboo.apiKey, startDate])

  // Vacation overlap tooltip for an employee. Vacation pay is the ENTITLED-days amount
  // (paid once per year at the first request), generated separately — not per period.
  const vacationInfo = (emp: Employee): string | null => {
    const overlapping = getVacationsOverlappingPeriod(getVacationsForEmployee(emp.id, vacations), startDate, endDate)
    if (overlapping.length === 0) return null
    const period = overlapping.map((v) => `${formatDate(v.start)} → ${formatDate(v.end)}`).join('\n')
    const pay = calculateVacationPay(country, emp.payRate, yearsOfService(emp.hireDate), emp.payType)
    const amount = pay ? formatCurrencyWithSymbol(pay.gross, getCurrencySymbol(country)) : '—'
    return t('payroll.review.vacationTooltip', { period, amount })
  }
  const [hours, setHours] = useState<EmployeeHoursEntry[]>(employeeHours)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [soloTarget, setSoloTarget] = useState<SoloTarget | null>(null)

  const holidays = useMemo(
    () => getHolidaysInRange(country, startDate, endDate),
    [country, startDate, endDate],
  )

  const updateHours = (employeeId: string, field: 'regularHours' | 'otHours' | 'holidayHours' | 'nightHours', raw: string) => {
    const val = roundHalfUp(parseFloat(raw) || 0, 2)
    setHours((prev) =>
      prev.map((h) =>
        h.employeeId === employeeId
          ? { ...h, [field]: val, source: 'manual', editedManually: true }
          : h,
      ),
    )
  }

  const updatePayRate = (employeeId: string, raw: string) => {
    const val = raw.trim() === '' ? undefined : roundHalfUp(parseFloat(raw) || 0, 2)
    setHours((prev) =>
      prev.map((h) =>
        h.employeeId === employeeId ? { ...h, payRateOverride: val } : h,
      ),
    )
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return hours.filter((h) => {
      const total = totalHours(h)
      // Filter tab
      if (filter === 'with-hours' && total <= 0) return false
      if (filter === 'zero-hours' && total !== 0) return false
      if (filter === 'no-match' && h.hubstaffUserId) return false
      if (filter === 'ot' && h.otHours <= 0) return false
      // Name search (combined with the active filter tab)
      if (q) {
        const emp = employees.find((e) => e.id === h.employeeId)
        if (!emp) return false
        if (!`${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [hours, filter, search, employees])

  const filterCounts = useMemo(() => ({
    all: hours.length,
    'with-hours': hours.filter((h) => totalHours(h) > 0).length,
    'zero-hours': hours.filter((h) => totalHours(h) === 0).length,
    'no-match': hours.filter((h) => !h.hubstaffUserId).length,
    ot: hours.filter((h) => h.otHours > 0).length,
  }), [hours])

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: t('payroll.review.filterAll') },
    { key: 'with-hours', label: t('payroll.review.filterWithHours') },
    { key: 'zero-hours', label: t('payroll.review.filterZeroHours') },
    { key: 'no-match', label: t('payroll.review.filterNoMatch') },
    { key: 'ot', label: t('payroll.review.filterOT') },
  ]

  return (
    <div className="space-y-4">
      {/* Unmapped employees banner */}
      {filterCounts['no-match'] > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-orange-500" />
            <span className="text-xs text-orange-700">
              {t('payroll.review.unmappedBanner', { count: filterCounts['no-match'] })}
            </span>
          </div>
          <Link
            to="/nomina/connectors"
            className="shrink-0 text-xs font-semibold text-orange-700 underline underline-offset-2 hover:text-orange-900"
          >
            {t('payroll.review.configureMapping')}
          </Link>
        </div>
      )}

      {/* Holiday banner */}
      {holidays.length > 0 && (
        <div className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 shrink-0">
            <CalendarDays className="h-4 w-4 text-amber-600" />
            <span className="text-xs font-semibold text-amber-800">
              {t('payroll.review.holidaysBanner', { count: holidays.length })}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {holidays.map((h) => (
              <span
                key={h.id}
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-700 border border-amber-200"
              >
                <span className="font-mono">{h.date.slice(5)}</span>
                {h.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top action buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>{t('common.back')}</Button>
        <Button onClick={() => onNext(hours)}>
          {t('payroll.calculate.calculate')}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle>{t('payroll.review.title')}</CardTitle>
                  {country && (
                    <span className="text-base leading-none" title={country}>
                      {countryFlag(country)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {startDate} – {endDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Employee search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('payroll.review.searchPlaceholder')}
                  className="h-8 w-48 pl-8 text-xs"
                />
              </div>

              {/* Filter bar */}
              <div className="flex items-center gap-1.5 rounded-lg border border-input bg-secondary p-1">
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={[
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    filter === key
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-muted-foreground',
                  ].join(' ')}
                >
                  {label}
                  <span className={[
                    'rounded-full px-1.5 py-px text-[10px] font-semibold',
                    filter === key ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground',
                  ].join(' ')}>
                    {filterCounts[key]}
                  </span>
                </button>
              ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-44">
                    {t('payroll.review.employee')}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.review.regularHours')}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.review.otHours')}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.review.holidayHours')}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.review.nightHours')}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.review.totalHours')}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.review.payRate')}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.review.status')}
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('payroll.review.calculateSolo')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-sm text-muted-foreground">
                      {t('payroll.review.noHours')}
                    </td>
                  </tr>
                ) : (
                  filtered.map((h) => {
                    const emp = employees.find((e) => e.id === h.employeeId)
                    if (!emp) return null
                    const total = totalHours(h)
                    return (
                      <tr key={h.employeeId} className="hover:bg-secondary">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                              {getInitials(emp.firstName, emp.lastName)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-foreground text-xs truncate">
                                  {emp.firstName} {emp.lastName}
                                </p>
                                {(() => {
                                  const method: PaymentMethod = paymentMethods[emp.id] ?? 'transfer'
                                  const Icon = PAYMENT_ICON[method]
                                  const acct = bankAccounts[emp.id]
                                  const title = method === 'transfer' && acct?.bank
                                    ? [PAYMENT_METHOD_LABELS[uiLang].transfer, acct.bank, maskAccount(acct.accountNumber)].filter(Boolean).join(' · ')
                                    : PAYMENT_METHOD_LABELS[uiLang][method]
                                  return (
                                    <span
                                      title={title}
                                      className="inline-flex shrink-0 items-center text-muted-foreground"
                                    >
                                      <Icon className="h-3 w-3" />
                                    </span>
                                  )
                                })()}
                                {(() => {
                                  const info = vacationInfo(emp)
                                  if (!info) return null
                                  return (
                                    <span
                                      title={info}
                                      className="inline-flex shrink-0 items-center text-emerald-600"
                                    >
                                      <Palmtree className="h-3 w-3" />
                                    </span>
                                  )
                                })()}
                                {(() => {
                                  const info = pendingIsrInfo(emp)
                                  if (!info) return null
                                  return (
                                    <span
                                      title={info}
                                      className="inline-flex shrink-0 items-center text-amber-600"
                                    >
                                      <Coins className="h-3 w-3" />
                                    </span>
                                  )
                                })()}
                              </div>
                              <p className="text-[10px] text-muted-foreground truncate">{emp.jobTitle}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <HoursInput
                            value={h.regularHours}
                            onChange={(v) => updateHours(h.employeeId, 'regularHours', v)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <HoursInput
                            value={h.otHours}
                            onChange={(v) => updateHours(h.employeeId, 'otHours', v)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <HoursInput
                            value={h.holidayHours}
                            onChange={(v) => updateHours(h.employeeId, 'holidayHours', v)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <HoursInput
                            value={h.nightHours ?? 0}
                            onChange={(v) => updateHours(h.employeeId, 'nightHours', v)}
                          />
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-foreground">
                          {total}
                        </td>
                        <td className="px-3 py-3 text-right text-muted-foreground text-xs">
                          {emp.payRateCurrency === '' ? (
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder={t('employees.payRateNotSet')}
                              className="h-7 w-24 text-right text-xs ml-auto"
                              value={h.payRateOverride ?? ''}
                              onChange={(e) => updatePayRate(h.employeeId, e.target.value)}
                            />
                          ) : (
                            formatCurrency(emp.payRate)
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            {emp.payType === 'Salary' ? (
                              // Salary pay is fixed; hours aren't required → never "Zero Hours"/"Needs Mapping".
                              <Badge variant="default">
                                <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                                {t('payroll.review.salary')}
                              </Badge>
                            ) : (
                              <>
                                <MatchBadge entry={h} total={total} t={t} />
                                <Badge variant="info" className="text-[10px]">
                                  {emp.payType}
                                </Badge>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            type="button"
                            title={t('payroll.review.soloPaystub')}
                            onClick={() => setSoloTarget({ employee: emp, hoursEntry: h })}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                          >
                            <Calculator className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom action buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>{t('common.back')}</Button>
        <Button onClick={() => onNext(hours)}>
          {t('payroll.calculate.calculate')}
        </Button>
      </div>

      {/* Single employee paystub modal */}
      {soloTarget && (
        <SinglePaystubModal
          employee={soloTarget.employee}
          hoursEntry={soloTarget.hoursEntry}
          startDate={startDate}
          endDate={endDate}
          frequency={frequency}
          country={country}
          onClose={() => setSoloTarget(null)}
        />
      )}
    </div>
  )
}

function HoursInput({ value, onChange }: { value: number; onChange: (v: string) => void }) {
  return (
    <Input
      type="number"
      min="0"
      step="0.5"
      className="h-7 w-20 text-right text-xs ml-auto"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function MatchBadge({
  entry,
  total,
  t,
}: {
  entry: EmployeeHoursEntry
  total: number
  t: (key: string) => string
}) {
  if (entry.editedManually) {
    return (
      <Badge variant="info">
        <Pencil className="mr-1 h-2.5 w-2.5" />
        {t('payroll.review.edited')}
      </Badge>
    )
  }
  if (!entry.hubstaffUserId) {
    return (
      <Badge variant="warning">
        <MapPin className="mr-1 h-2.5 w-2.5" />
        {t('payroll.review.needsMapping')}
      </Badge>
    )
  }
  if (total === 0) {
    return (
      <Badge variant="warning">
        <AlertTriangle className="mr-1 h-2.5 w-2.5" />
        {t('payroll.review.zeroHours')}
      </Badge>
    )
  }
  return (
    <Badge variant="default">
      <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
      {t('payroll.review.matched')}
    </Badge>
  )
}
