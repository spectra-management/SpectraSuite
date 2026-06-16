import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, Pencil, CheckCircle2, AlertTriangle, MapPin, CalendarDays, ChevronDown, ChevronRight, Calculator } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useEmployeesStore } from '@/store/employeesStore'
import { formatCurrency, getInitials } from '@/lib/utils'
import { roundHalfUp } from '@/lib/payroll/calculations'
import { getDRHolidaysInRange } from '@/lib/drHolidays'
import { SinglePaystubModal } from './SinglePaystubModal'
import type { EmployeeHoursEntry, Employee } from '@/types'

type Filter = 'all' | 'with-hours' | 'zero-hours' | 'no-match'

interface Props {
  employeeHours: EmployeeHoursEntry[]
  startDate: string
  endDate: string
  frequency: 'biweekly' | 'weekly'
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

export function StepHours({ employeeHours, startDate, endDate, frequency, onNext, onBack }: Props) {
  const { t } = useTranslation()
  const employees = useEmployeesStore((s) => s.employees)
  const [hours, setHours] = useState<EmployeeHoursEntry[]>(employeeHours)
  const [filter, setFilter] = useState<Filter>('all')
  const [showSalaried, setShowSalaried] = useState(false)
  const [soloTarget, setSoloTarget] = useState<SoloTarget | null>(null)

  const salariedEmployees = useMemo(
    () => employees.filter((e) => e.status === 'Active' && e.payType !== 'Hourly'),
    [employees],
  )

  const holidays = useMemo(
    () => getDRHolidaysInRange(startDate, endDate),
    [startDate, endDate],
  )

  const updateHours = (employeeId: string, field: 'regularHours' | 'otHours' | 'holidayHours', raw: string) => {
    const val = roundHalfUp(parseFloat(raw) || 0, 2)
    setHours((prev) =>
      prev.map((h) =>
        h.employeeId === employeeId
          ? { ...h, [field]: val, source: 'manual', editedManually: true }
          : h,
      ),
    )
  }

  const filtered = useMemo(() => {
    return hours.filter((h) => {
      const total = totalHours(h)
      if (filter === 'with-hours') return total > 0
      if (filter === 'zero-hours') return total === 0
      if (filter === 'no-match') return !h.hubstaffUserId
      return true
    })
  }, [hours, filter])

  const filterCounts = useMemo(() => ({
    all: hours.length,
    'with-hours': hours.filter((h) => totalHours(h) > 0).length,
    'zero-hours': hours.filter((h) => totalHours(h) === 0).length,
    'no-match': hours.filter((h) => !h.hubstaffUserId).length,
  }), [hours])

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: t('payroll.review.filterAll') },
    { key: 'with-hours', label: t('payroll.review.filterWithHours') },
    { key: 'zero-hours', label: t('payroll.review.filterZeroHours') },
    { key: 'no-match', label: t('payroll.review.filterNoMatch') },
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
            to="/connectors"
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
                key={h.date}
                className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs text-amber-700 border border-amber-200"
              >
                <span className="font-mono">{h.date.slice(5)}</span>
                {h.movable && h.date !== h.canonicalDate && (
                  <span className="text-amber-400">({h.canonicalDate.slice(5)})</span>
                )}
                {t(`payroll.holidays.${h.key}`)}
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
                <CardTitle>{t('payroll.review.title')}</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">
                  {startDate} – {endDate}
                </p>
              </div>
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 p-1">
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={[
                    'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    filter === key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700',
                  ].join(' ')}
                >
                  {label}
                  <span className={[
                    'rounded-full px-1.5 py-px text-[10px] font-semibold',
                    filter === key ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500',
                  ].join(' ')}>
                    {filterCounts[key]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 w-44">
                    {t('payroll.review.employee')}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.review.regularHours')}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.review.otHours')}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.review.holidayHours')}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.review.totalHours')}
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.review.payRate')}
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.review.status')}
                  </th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {t('payroll.review.calculateSolo')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-400">
                      {t('payroll.review.noHours')}
                    </td>
                  </tr>
                ) : (
                  filtered.map((h) => {
                    const emp = employees.find((e) => e.id === h.employeeId)
                    if (!emp) return null
                    const total = totalHours(h)
                    return (
                      <tr key={h.employeeId} className="hover:bg-gray-50">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                              {getInitials(emp.firstName, emp.lastName)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 text-xs truncate">
                                {emp.firstName} {emp.lastName}
                              </p>
                              <p className="text-[10px] text-gray-400 truncate">{emp.jobTitle}</p>
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
                        <td className="px-3 py-3 text-right font-semibold text-gray-900">
                          {total}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-600 text-xs">
                          {formatCurrency(emp.payRate)}
                        </td>
                        <td className="px-3 py-3">
                          <MatchBadge entry={h} total={total} t={t} />
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

      {/* Salaried employees — excluded, shown collapsed */}
      {salariedEmployees.length > 0 && (
        <div className="rounded-xl border border-gray-200">
          <button
            type="button"
            onClick={() => setShowSalaried((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 rounded-xl transition-colors"
          >
            <span className="text-sm font-medium text-gray-600">
              {t('payroll.review.salariedSection')} ({salariedEmployees.length})
            </span>
            {showSalaried
              ? <ChevronDown className="h-4 w-4 text-gray-400" />
              : <ChevronRight className="h-4 w-4 text-gray-400" />}
          </button>
          {showSalaried && (
            <div className="border-t border-gray-100 px-4 py-3 space-y-1">
              <p className="text-xs text-gray-400 mb-2">{t('payroll.review.salariedNote')}</p>
              {salariedEmployees.map((e) => (
                <div key={e.id} className="flex items-center gap-2 py-1 opacity-60">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-500">
                    {getInitials(e.firstName, e.lastName)}
                  </div>
                  <span className="text-xs text-gray-600">{e.firstName} {e.lastName}</span>
                  <span className="text-[10px] text-gray-400">— {e.jobTitle}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {t('payroll.review.salary')}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
