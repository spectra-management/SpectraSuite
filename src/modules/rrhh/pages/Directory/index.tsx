import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Search, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardDescription } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Pagination } from '@/shared/components/ui/pagination'
import { formatDate, normalize } from '@/shared/lib/utils'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useRrhhDirectory } from '@/modules/rrhh/hooks/useRrhhDirectory'
import { useRrhhPhotos } from '@/modules/rrhh/hooks/useRrhhPhotos'
import { RrhhPageHeader } from '@/modules/rrhh/components/RrhhPageHeader'
import { RrhhAvatar } from '@/modules/rrhh/components/RrhhAvatar'
import { NotConnectedCard, LoadErrorCard, EmptyStateCard } from '@/modules/rrhh/components/RrhhStates'
import { buildPhotoProxyUrl } from '@/modules/rrhh/lib/connectors/bamboohr'
import { countryFlag } from '@/modules/rrhh/lib/format'
import type { RrhhEmployeeStatus } from '@/modules/rrhh/types'

const PAGE_SIZE = 25
type SortCol = 'name' | 'department' | 'hireDate'
type SortDir = 'asc' | 'desc'

function statusVariant(status: RrhhEmployeeStatus): 'default' | 'secondary' | 'destructive' {
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

export default function Directory() {
  const { t } = useTranslation()
  const { employees, syncing, error, connected, sync, lastSync } = useRrhhDirectory()
  const { customUrlFor } = useRrhhPhotos()
  const subdomain = useSettingsStore((s) => s.bamboohr.subdomain)

  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('Active')
  const [sortCol, setSortCol] = useState<SortCol | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)

  const depts = useMemo(
    () => [...new Set(employees.map((e) => e.department).filter(Boolean))].sort(),
    [employees],
  )
  const locations = useMemo(
    () => [...new Set(employees.map((e) => e.location).filter(Boolean))].sort(),
    [employees],
  )

  const activeFilterCount = [
    deptFilter !== 'all',
    locationFilter !== 'all',
    statusFilter !== 'Active',
    !!search,
  ].filter(Boolean).length

  const clearFilters = () => {
    setSearch('')
    setDeptFilter('all')
    setLocationFilter('all')
    setStatusFilter('Active')
    setPage(1)
  }

  const handleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortCol(col); setSortDir('asc') }
    setPage(1)
  }

  const filtered = useMemo(() => {
    const q = normalize(search)
    return employees
      .filter((e) => {
        if (q && !normalize(`${e.displayName} ${e.jobTitle} ${e.workEmail}`).includes(q)) return false
        if (deptFilter !== 'all' && e.department !== deptFilter) return false
        if (locationFilter !== 'all' && e.location !== locationFilter) return false
        if (statusFilter === 'Active' && e.status !== 'Active') return false
        if (statusFilter === 'not-active' && e.status === 'Active') return false
        return true
      })
      .sort((a, b) => {
        if (!sortCol) return a.displayName.localeCompare(b.displayName)
        let cmp = 0
        if (sortCol === 'name') cmp = a.displayName.localeCompare(b.displayName)
        if (sortCol === 'department') cmp = a.department.localeCompare(b.department)
        if (sortCol === 'hireDate') cmp = (a.hireDate || '').localeCompare(b.hireDate || '')
        return sortDir === 'asc' ? cmp : -cmp
      })
  }, [employees, search, deptFilter, locationFilter, statusFilter, sortCol, sortDir])

  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleFilter = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1) }

  const header = (
    <RrhhPageHeader
      title={t('rrhh.directory.title')}
      subtitle={t('rrhh.directory.subtitle')}
      syncing={syncing}
      onSync={connected ? sync : undefined}
      lastSync={lastSync}
    />
  )

  // Connection / error / empty states (still show the header so Sync is reachable).
  if (!connected) return <div className="space-y-6">{header}<NotConnectedCard /></div>
  if (error && employees.length === 0) {
    return <div className="space-y-6">{header}<LoadErrorCard message={error === 'not-connected' ? undefined : error} onRetry={sync} /></div>
  }
  if (employees.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyStateCard
          title={t('rrhh.directory.empty')}
          hint={t('rrhh.directory.emptyHint')}
          action={
            <Button className="mt-1" onClick={sync} disabled={syncing}>
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

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('rrhh.directory.searchPlaceholder')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>

            <Select value={deptFilter} onValueChange={handleFilter(setDeptFilter)}>
              <SelectTrigger className="w-44"><SelectValue placeholder={t('rrhh.directory.allDepartments')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('rrhh.directory.allDepartments')}</SelectItem>
                {depts.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>

            {locations.length > 1 && (
              <Select value={locationFilter} onValueChange={handleFilter(setLocationFilter)}>
                <SelectTrigger className="w-44"><SelectValue placeholder={t('rrhh.directory.allLocations')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('rrhh.directory.allLocations')}</SelectItem>
                  {locations.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            <Select value={statusFilter} onValueChange={handleFilter(setStatusFilter)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">{t('rrhh.status.active')}</SelectItem>
                <SelectItem value="not-active">{t('rrhh.status.inactive')}</SelectItem>
                <SelectItem value="all">{t('rrhh.directory.allStatuses')}</SelectItem>
              </SelectContent>
            </Select>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="mr-1 h-3.5 w-3.5" />
                {t('rrhh.common.clearFilters')}
              </Button>
            )}

            <CardDescription className="ml-auto whitespace-nowrap">
              {t('rrhh.common.showing', { count: filtered.length, total: employees.length })}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-sm text-muted-foreground">{t('rrhh.common.noResults')}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                {t('rrhh.common.clearFilters')}
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <button className="flex items-center hover:text-foreground transition-colors" onClick={() => handleSort('name')}>
                          {t('rrhh.directory.table.name')}
                          <SortIcon col="name" sortCol={sortCol} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('rrhh.directory.table.jobTitle')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <button className="flex items-center hover:text-foreground transition-colors" onClick={() => handleSort('department')}>
                          {t('rrhh.directory.table.department')}
                          <SortIcon col="department" sortCol={sortCol} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('rrhh.directory.table.location')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <button className="flex items-center hover:text-foreground transition-colors" onClick={() => handleSort('hireDate')}>
                          {t('rrhh.directory.table.hireDate')}
                          <SortIcon col="hireDate" sortCol={sortCol} sortDir={sortDir} />
                        </button>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('rrhh.directory.table.status')}
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
                            <RrhhAvatar
                              employee={emp}
                              customSrc={customUrlFor(emp.id)}
                              src={buildPhotoProxyUrl(subdomain, emp.id, 'small')}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground">{emp.displayName}</p>
                              <p className="text-xs text-muted-foreground">{emp.workEmail || '—'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{emp.jobTitle || '—'}</td>
                        <td className="px-6 py-4 text-muted-foreground">{emp.department || '—'}</td>
                        <td className="px-6 py-4 text-muted-foreground">{emp.location || '—'}</td>
                        <td className="px-6 py-4 text-muted-foreground">{formatDate(emp.hireDate)}</td>
                        <td className="px-6 py-4">
                          <Badge variant={statusVariant(emp.status)}>
                            {t(`rrhh.status.${emp.status.toLowerCase()}`)}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/rrhh/directory/${emp.id}`}>{t('rrhh.common.viewProfile')}</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
