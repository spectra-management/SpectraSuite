import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee'
import { useRrhhDirectory } from '@/modules/rrhh/hooks/useRrhhDirectory'
import { useRrhhPhotos } from '@/modules/rrhh/hooks/useRrhhPhotos'
import { buildPhotoProxyUrl } from '@/modules/rrhh/lib/connectors/bamboohr'
import { RrhhPageHeader } from '@/modules/rrhh/components/RrhhPageHeader'
import { RrhhAvatar } from '@/modules/rrhh/components/RrhhAvatar'
import { NotConnectedCard, EmptyStateCard } from '@/modules/rrhh/components/RrhhStates'
import { buildOrgChart, countReports } from '@/modules/rrhh/lib/derive'
import type { OrgNode } from '@/modules/rrhh/types'

function collectExpandableIds(nodes: OrgNode[], acc: Set<string>): Set<string> {
  for (const node of nodes) {
    if (node.reports.length > 0) {
      acc.add(node.employee.id)
      collectExpandableIds(node.reports, acc)
    }
  }
  return acc
}

function OrgCard({
  node, expanded, onToggle, isRoot, currentId, photoSrc, signedSrc,
}: {
  node: OrgNode
  expanded: Set<string>
  onToggle: (id: string) => void
  isRoot: boolean
  currentId: string | null
  photoSrc: (id: string) => string
  signedSrc: (id: string) => string | undefined
}) {
  const { employee, reports } = node
  const hasReports = reports.length > 0
  const isOpen = expanded.has(employee.id)
  const total = useMemo(() => countReports(node), [node])
  const isMe = employee.id === currentId

  return (
    <div
      className={cn(
        'org-card relative w-[190px] rounded-xl border bg-card px-3 pb-2.5 pt-9 text-center shadow-sm transition-shadow hover:shadow-md',
        isRoot || isMe ? 'border-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/30' : 'border-border',
      )}
      title={total > 0 ? `${employee.displayName} · ${total}` : employee.displayName}
    >
      {/* Photo overlapping the top edge */}
      <div className="absolute -top-7 left-1/2 -translate-x-1/2">
        <span className="block rounded-2xl bg-card p-0.5 shadow-sm">
          <RrhhAvatar
            employee={employee}
            size="lg"
            customSrc={signedSrc(employee.id)}
            src={photoSrc(employee.id)}
          />
        </span>
      </div>

      <Link
        to={`/rrhh/directory/${employee.id}`}
        className="block truncate text-sm font-semibold text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-400"
      >
        {employee.displayName}
      </Link>
      {employee.jobTitle && (
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{employee.jobTitle}</p>
      )}

      {hasReports && (
        <button
          type="button"
          onClick={() => onToggle(employee.id)}
          aria-expanded={isOpen}
          className="mt-2 flex w-full items-center justify-center gap-1 border-t border-border pt-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-emerald-700 dark:hover:text-emerald-400"
        >
          {reports.length}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
        </button>
      )}
    </div>
  )
}

function OrgBranch(props: {
  node: OrgNode
  expanded: Set<string>
  onToggle: (id: string) => void
  isRoot: boolean
  currentId: string | null
  photoSrc: (id: string) => string
  signedSrc: (id: string) => string | undefined
}) {
  const { node, expanded } = props
  const hasReports = node.reports.length > 0
  const isOpen = expanded.has(node.employee.id)

  return (
    <div className="org-li">
      <OrgCard {...props} />
      {hasReports && isOpen && (
        <div className="org-ul">
          {node.reports.map((child) => (
            <OrgBranch key={child.employee.id} {...props} node={child} isRoot={false} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OrgChart() {
  const { t } = useTranslation()
  const { employees, syncing, connected, sync, lastSync } = useRrhhDirectory()
  const { signedUrlFor } = useRrhhPhotos()
  const subdomain = useSettingsStore((s) => s.bamboohr.subdomain)
  const { employee: me } = useCurrentEmployee()

  const roots = useMemo(() => buildOrgChart(employees), [employees])
  const allExpandableIds = useMemo(() => collectExpandableIds(roots, new Set<string>()), [roots])

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(allExpandableIds))
  const [zoom, setZoom] = useState(1)

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const expandAll = () => setExpanded(new Set(allExpandableIds))
  const collapseAll = () => setExpanded(new Set<string>())
  const photoSrc = (id: string) => buildPhotoProxyUrl(subdomain, id, 'small')

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

  if (!connected && employees.length === 0) {
    return <div className="space-y-6">{header}<NotConnectedCard /></div>
  }
  if (employees.length === 0) {
    return <div className="space-y-6">{header}<EmptyStateCard title={t('rrhh.org.empty')} hint={t('rrhh.org.emptyHint')} /></div>
  }

  return (
    <div className="space-y-6">
      {header}

      <Card>
        <CardContent className="relative p-0">
          {/* Zoom controls */}
          <div className="absolute right-4 top-4 z-10 flex flex-col gap-1.5">
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))} aria-label={t('rrhh.org.zoomIn')}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} aria-label={t('rrhh.org.zoomOut')}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" onClick={() => setZoom(1)} aria-label={t('rrhh.org.zoomReset')}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="overflow-auto p-6 pt-10">
            <div
              className="org-root min-w-max"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 120ms ease' }}
            >
              {roots.map((root) => (
                <OrgBranch
                  key={root.employee.id}
                  node={root}
                  expanded={expanded}
                  onToggle={toggle}
                  isRoot
                  currentId={me?.id ?? null}
                  photoSrc={photoSrc}
                  signedSrc={signedUrlFor}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
