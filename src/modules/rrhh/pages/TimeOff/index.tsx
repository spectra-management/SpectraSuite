import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CalendarDays, Clock, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { formatDateRange } from '@/shared/lib/utils'
import { useRrhhDirectory } from '@/modules/rrhh/hooks/useRrhhDirectory'
import { useRrhhTimeOff } from '@/modules/rrhh/hooks/useRrhhTimeOff'
import { RrhhPageHeader } from '@/modules/rrhh/components/RrhhPageHeader'
import { NotConnectedCard, LoadErrorCard, EmptyStateCard } from '@/modules/rrhh/components/RrhhStates'
import { buildTimeOffBalances } from '@/modules/rrhh/lib/derive'

export default function TimeOff() {
  const { t } = useTranslation()
  const { employees } = useRrhhDirectory()
  const { timeOff, year, syncing, connected, sync, error } = useRrhhTimeOff()

  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(year ?? currentYear)
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => currentYear - i),
    [currentYear],
  )

  const employeeIds = useMemo(() => new Set(employees.map((e) => e.id)), [employees])

  const balances = useMemo(
    () => buildTimeOffBalances(timeOff, employees),
    [timeOff, employees],
  )

  const totalDays = useMemo(() => timeOff.reduce((sum, r) => sum + r.days, 0), [timeOff])

  const sortedRequests = useMemo(
    () => [...timeOff].sort((a, b) => (b.start || '').localeCompare(a.start || '')),
    [timeOff],
  )

  const yearSelect = (
    <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
      <SelectTrigger className="w-32">
        <SelectValue placeholder={t('rrhh.timeOff.year')} />
      </SelectTrigger>
      <SelectContent>
        {yearOptions.map((y) => (
          <SelectItem key={y} value={String(y)}>{String(y)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const header = (
    <RrhhPageHeader
      title={t('rrhh.timeOff.title')}
      subtitle={t('rrhh.timeOff.subtitle')}
      syncing={syncing}
      onSync={connected ? () => sync(selectedYear) : undefined}
      actions={yearSelect}
    />
  )

  if (!connected) {
    return <div className="space-y-6">{header}<NotConnectedCard /></div>
  }

  if (error && timeOff.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <LoadErrorCard
          message={error === 'not-connected' ? undefined : error}
          onRetry={() => sync(selectedYear)}
        />
      </div>
    )
  }

  if (timeOff.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyStateCard
          title={t('rrhh.timeOff.empty')}
          hint={t('rrhh.timeOff.emptyHint')}
          action={
            <Button className="mt-1" onClick={() => sync(selectedYear)} disabled={syncing}>
              {syncing ? t('rrhh.common.syncing') : t('rrhh.common.sync')}
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}

      <p className="text-xs text-muted-foreground">{t('rrhh.timeOff.note')}</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-foreground">{timeOff.length}</p>
              <p className="text-sm text-muted-foreground">{t('rrhh.timeOff.requests')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalDays}</p>
              <p className="text-sm text-muted-foreground">{t('rrhh.timeOff.totalDays')}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-foreground">{balances.length}</p>
              <p className="text-sm text-muted-foreground">{t('rrhh.timeOff.employeesWithTimeOff')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('rrhh.timeOff.balancesTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('rrhh.timeOff.employee')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('rrhh.timeOff.totalDays')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('rrhh.timeOff.requests')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {balances.map((bal) => (
                  <tr key={bal.employeeId} className="hover:bg-secondary transition-colors">
                    <td className="px-6 py-4">
                      {employeeIds.has(bal.employeeId) ? (
                        <Link
                          to={`/rrhh/directory/${bal.employeeId}`}
                          className="font-medium text-foreground hover:text-emerald-600"
                        >
                          {bal.employeeName}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">{bal.employeeName}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {t('rrhh.timeOff.days', { count: bal.totalDays })}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{bal.requestCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('rrhh.timeOff.requestsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('rrhh.timeOff.employee')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('rrhh.timeOff.type')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('rrhh.timeOff.dates')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('rrhh.timeOff.daysLabel')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('rrhh.timeOff.status')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-secondary transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground">{req.employeeName}</td>
                    <td className="px-6 py-4 text-muted-foreground">{req.typeName}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {formatDateRange(req.start, req.end)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{req.days}</td>
                    <td className="px-6 py-4">
                      <Badge variant={req.status === 'approved' ? 'default' : 'secondary'}>
                        {req.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
