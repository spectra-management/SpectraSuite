import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Search, User, ArrowUpDown, ArrowUp, ArrowDown, X, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
import { useEmployeesStore } from '@/store/employeesStore'
import { useSettingsStore } from '@/store/settingsStore'
import { fetchBambooDirectory } from '@/lib/connectors/bamboohr'
import { toast } from '@/hooks/useToast'
import { formatPayRate, formatDate, getInitials, normalize } from '@/lib/utils'
import { EmployeeReports } from './EmployeeReports'
import type { Employee } from '@/types'

const PAGE_SIZE = 25
type SortCol = 'name' | 'payRate' | 'hireDate'
type SortDir = 'asc' | 'desc'

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

function statusVariant(status: Employee['status']): 'default' | 'secondary' | 'destructive' {
  if (status === 'Active') return 'default'
  if (status === 'Inactive') return 'secondary'
  return 'destructive'
}

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol | null; sortDir: SortDir }) {
  if (sortCol !== col) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />
  return sortDir === 'asc'
    ? <ArrowUp className="ml-1 inline h-3 w-3 text-emerald-600" />
    : <ArrowDown className="ml-1 inline h-3 w-3 text-emerald-600" />
}

export default function Employees() {
  const { t } = useTranslation()
  const employees = useEmployeesStore((s) => s.employees)
  const setEmployees = useEmployeesStore((s) => s.setEmployees)
  const setLastSync = useEmployeesStore((s) => s.setLastSync)
  const bamboohr = useSettingsStore((s) => s.bamboohr)

  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [titleFilter, setTitleFilter] = useState('all')
  const [payTypeFilter, setPayTypeFilter] = useState('all')
  const [countryFilter, setCountryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<string>(
    () => localStorage.getItem('spectra_employees_status_filter') ?? 'Active',
  )
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [syncing, setSyncing] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)

  // Unique department and job title options
  const depts = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter(Boolean))].sort(),
    [employees],
  )
  const titles = useMemo(
    () => [...new Set(employees.map((e) => e.jobTitle).filter(Boolean))].sort(),
    [employees],
  )
  // Unique countries from employees
  const availableCountries = useMemo(() => {
    const set = new Set<string>()
    for (const e of employees) {
      const c = e.country && e.country.trim() ? e.country.trim() : 'Unknown'
      set.add(c)
    }
    return [...set].sort()
  }, [employees])

  const activeFilterCount = [
    deptFilter !== 'all',
    titleFilter !== 'all',
    payTypeFilter !== 'all',
    countryFilter !== 'all',
    statusFilter !== 'Active',   // 'Active' is the default, not a filter override
    !!search,
  ].filter(Boolean).length

  const clearFilters = () => {
    setSearch('')
    setDeptFilter('all')
    setTitleFilter('all')
    setPayTypeFilter('all')
    setCountryFilter('all')
    const defaultStatus = 'Active'
    setStatusFilter(defaultStatus)
    localStorage.setItem('spectra_employees_status_filter', defaultStatus)
    setPage(1)
  }

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setPage(1)
  }

  const filtered = useMemo(() => {
    const q = normalize(search)
    return employees
      .filter((e) => {
        if (q && !normalize(`${e.firstName} ${e.lastName} ${e.workEmail}`).includes(q)) return false
        if (deptFilter !== 'all' && e.department !== deptFilter) return false
        if (titleFilter !== 'all' && e.jobTitle !== titleFilter) return false
        if (payTypeFilter !== 'all' && e.payType !== payTypeFilter) return false
        if (countryFilter !== 'all') {
          const empCountry = e.country && e.country.trim() ? e.country.trim() : 'Unknown'
          if (empCountry !== countryFilter) return false
        }
        if (statusFilter === 'Active' && e.status !== 'Active') return false
        if (statusFilter === 'not-active' && e.status === 'Active') return false
        return true
      })
      .sort((a, b) => {
        if (!sortCol) return 0
        let cmp = 0
        if (sortCol === 'name') cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        if (sortCol === 'payRate') cmp = a.payRate - b.payRate
        if (sortCol === 'hireDate') cmp = (a.hireDate || '').localeCompare(b.hireDate || '')
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [employees, search, deptFilter, titleFilter, payTypeFilter, countryFilter, statusFilter, sortCol, sortDir])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleFilterChange = (setter: (v: string) => void, persistKey?: string) => (v: string) => {
    setter(v)
    if (persistKey) localStorage.setItem(persistKey, v)
    setPage(1)
  }

  const handleSync = async () => {
    if (!bamboohr.subdomain || !bamboohr.apiKey) {
      toast({ variant: 'destructive', title: t('errors.apiKeyMissing'), description: t('connectors.bamboohr.notConnected') })
      return
    }
    setSyncing(true)
    try {
      const synced = await fetchBambooDirectory(bamboohr.subdomain, bamboohr.apiKey)
      const merged = synced.map((fresh) => {
        const existing = employees.find((e) => e.id === fresh.id)
        return existing
          ? { ...fresh, customDeductions: existing.customDeductions, hubstaffUserId: existing.hubstaffUserId }
          : fresh
      })
      setEmployees(merged)
      setLastSync(new Date().toISOString())
      setPage(1)
      toast({ variant: 'success', title: t('employees.syncSuccess') })
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('errors.syncFailed')
      toast({ variant: 'destructive', title: t('employees.syncError'), description: msg })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('employees.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('employees.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setReportsOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            {t('employees.reports.button')}
          </Button>
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? t('common.syncing') : t('employees.syncButton')}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Department filter */}
            <Select value={deptFilter} onValueChange={handleFilterChange(setDeptFilter)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t('employees.filters.allDepartments')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('employees.filters.allDepartments')}</SelectItem>
                {depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Job title filter */}
            <Select value={titleFilter} onValueChange={handleFilterChange(setTitleFilter)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t('employees.filters.allTitles')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('employees.filters.allTitles')}</SelectItem>
                {titles.map((t2) => <SelectItem key={t2} value={t2}>{t2}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Pay Type filter */}
            <Select value={payTypeFilter} onValueChange={handleFilterChange(setPayTypeFilter)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('employees.filters.allPayTypes')}</SelectItem>
                <SelectItem value="Hourly">{t('employees.filters.hourly')}</SelectItem>
                <SelectItem value="Salary">{t('employees.filters.salary')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Country filter */}
            {availableCountries.length > 1 && (
              <Select value={countryFilter} onValueChange={handleFilterChange(setCountryFilter)}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder={t('employees.filters.allCountries')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('employees.filters.allCountries')}</SelectItem>
                  {availableCountries.map((c) => (
                    <SelectItem key={c} value={c}>
                      {countryFlag(c)} {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Status filter */}
            <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter, 'spectra_employees_status_filter')}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">{t('employees.status.active')}</SelectItem>
                <SelectItem value="not-active">{t('employees.filters.inactiveTerminated')}</SelectItem>
                <SelectItem value="all">{t('employees.filters.allStatuses')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Clear filters */}
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="mr-1 h-3.5 w-3.5" />
                {t('employees.filters.clearFilters')}
              </Button>
            )}

            <CardDescription className="ml-auto whitespace-nowrap">
              {t('common.showing', { count: filtered.length, total: employees.length })}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                <User className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                {employees.length === 0 ? t('employees.noEmployees') : 'No employees match the current filters.'}
              </p>
              {activeFilterCount > 0 && (
                <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                  {t('employees.filters.clearFilters')}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <button className="flex items-center hover:text-foreground transition-colors" onClick={() => handleSort('name')}>
                          {t('employees.table.name')}
                          <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('employees.table.department')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('employees.table.jobTitle')}
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <button className="flex items-center ml-auto hover:text-foreground transition-colors" onClick={() => handleSort('payRate')}>
                          {t('employees.table.payRate')}
                          <SortIcon col="payRate" sortCol={sortCol} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <button className="flex items-center hover:text-foreground transition-colors" onClick={() => handleSort('hireDate')}>
                          {t('employees.table.hireDate')}
                          <SortIcon col="hireDate" sortCol={sortCol} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('employees.table.status')}
                      </th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paginated.map((emp) => (
                      <tr key={emp.id} className="hover:bg-secondary transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-base leading-none shrink-0" title={emp.country || 'Unknown'}>
                              {countryFlag(emp.country)}
                            </span>
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
                              {getInitials(emp.firstName, emp.lastName)}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{emp.firstName} {emp.lastName}</p>
                              <p className="text-xs text-muted-foreground">{emp.workEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{emp.department || '—'}</td>
                        <td className="px-6 py-4 text-muted-foreground">{emp.jobTitle || '—'}</td>
                        <td className="px-6 py-4 text-right">
                          {emp.payRateCurrency === '' ? (
                            <span className="text-xs font-medium text-amber-600">{t('employees.payRateNotSet')}</span>
                          ) : (
                            <span className="font-medium text-foreground">
                              {formatPayRate(emp.payRate, emp.payRateCurrency)}
                              {emp.payType === 'Hourly' ? '/hr' : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{formatDate(emp.hireDate)}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant={statusVariant(emp.status)}>
                              {t(`employees.status.${emp.status.toLowerCase()}`)}
                            </Badge>
                            <Badge variant={emp.payType === 'Hourly' ? 'info' : 'secondary'} className="text-[10px]">
                              {emp.payType}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/nomina/employees/${emp.id}`}>{t('common.viewDetails')}</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                onPage={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <EmployeeReports
        open={reportsOpen}
        onClose={() => setReportsOpen(false)}
        employees={filtered}
      />
    </div>
  )
}
