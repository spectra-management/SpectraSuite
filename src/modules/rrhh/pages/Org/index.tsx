import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronRight, ChevronDown, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'
import { useRrhhDirectory } from '@/modules/rrhh/hooks/useRrhhDirectory'
import { RrhhPageHeader } from '@/modules/rrhh/components/RrhhPageHeader'
import { RrhhAvatar } from '@/modules/rrhh/components/RrhhAvatar'
import { NotConnectedCard, EmptyStateCard } from '@/modules/rrhh/components/RrhhStates'
import { buildOrgChart, countReports } from '@/modules/rrhh/lib/derive'
import type { OrgNode } from '@/modules/rrhh/types'

/** Collect the ids of every node that has at least one report (i.e. is expandable). */
function collectExpandableIds(nodes: OrgNode[], acc: Set<string>): Set<string> {
  for (const node of nodes) {
    if (node.reports.length > 0) {
      acc.add(node.employee.id)
      collectExpandableIds(node.reports, acc)
    }
  }
  return acc
}

function OrgNodeRow({
  node,
  depth,
  expanded,
  onToggle,
}: {
  node: OrgNode
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  const { t } = useTranslation()
  const { employee, reports } = node
  const hasReports = reports.length > 0
  const isOpen = expanded.has(employee.id)
  const total = useMemo(() => countReports(node), [node])

  return (
    <div>
      <div
        className="flex items-center gap-3 rounded-lg py-2 pr-3 transition-colors hover:bg-secondary"
        style={{ paddingLeft: depth * 24 + 8 }}
      >
        {hasReports ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onToggle(employee.id)}
            aria-expanded={isOpen}
            aria-label={isOpen ? t('rrhh.org.collapseAll') : t('rrhh.org.expandAll')}
          >
            {isOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <span className="h-6 w-6 shrink-0" aria-hidden="true" />
        )}

        <RrhhAvatar employee={employee} size="sm" />

        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link
            to={`/rrhh/directory/${employee.id}`}
            className="truncate font-medium text-foreground transition-colors hover:text-emerald-600"
          >
            {employee.displayName}
          </Link>
          {employee.jobTitle && (
            <span className="truncate text-xs text-muted-foreground">{employee.jobTitle}</span>
          )}
          {hasReports && (
            <Badge variant="secondary" className="ml-1 shrink-0">
              {t('rrhh.org.directReports', { count: reports.length })}
              {total > reports.length && (
                <span className="ml-1 text-muted-foreground">
                  {t('rrhh.org.totalReports', { count: total })}
                </span>
              )}
            </Badge>
          )}
        </div>
      </div>

      {hasReports && isOpen && (
        <div className="border-l border-border" style={{ marginLeft: depth * 24 + 19 }}>
          {reports.map((child) => (
            <OrgNodeRow
              key={child.employee.id}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrgChart() {
  const { t } = useTranslation()
  const { employees, syncing, connected, sync, lastSync } = useRrhhDirectory()

  const roots = useMemo(() => buildOrgChart(employees), [employees])
  const allExpandableIds = useMemo(() => collectExpandableIds(roots, new Set<string>()), [roots])

  // Default: expand the root level so the top of the hierarchy is visible.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const r of roots) if (r.reports.length > 0) initial.add(r.employee.id)
    return initial
  })

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const expandAll = () => setExpanded(new Set(allExpandableIds))
  const collapseAll = () => setExpanded(new Set<string>())

  const actions =
    connected && employees.length > 0 ? (
      <>
        <Button variant="outline" size="sm" onClick={expandAll}>
          <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5" />
          {t('rrhh.org.expandAll')}
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>
          <ChevronsDownUp className="mr-1.5 h-3.5 w-3.5" />
          {t('rrhh.org.collapseAll')}
        </Button>
      </>
    ) : undefined

  const header = (
    <RrhhPageHeader
      title={t('rrhh.org.title')}
      subtitle={t('rrhh.org.subtitle')}
      syncing={syncing}
      onSync={connected ? sync : undefined}
      lastSync={lastSync}
      actions={actions}
    />
  )

  if (!connected) {
    return (
      <div className="space-y-6">
        {header}
        <NotConnectedCard />
      </div>
    )
  }

  if (employees.length === 0) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyStateCard title={t('rrhh.org.empty')} hint={t('rrhh.org.emptyHint')} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {header}

      <Card>
        <CardContent className={cn('p-4 sm:p-6')}>
          <p className="mb-3 text-xs text-muted-foreground">{t('rrhh.org.rootsNote')}</p>
          <div className="space-y-1">
            {roots.map((root) => (
              <OrgNodeRow
                key={root.employee.id}
                node={root}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
