import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Users, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'
import { useRrhhDirectory } from '@/modules/rrhh/hooks/useRrhhDirectory'
import { RrhhPageHeader } from '@/modules/rrhh/components/RrhhPageHeader'
import { RrhhAvatar } from '@/modules/rrhh/components/RrhhAvatar'
import { NotConnectedCard, EmptyStateCard } from '@/modules/rrhh/components/RrhhStates'
import { buildDepartments } from '@/modules/rrhh/lib/derive'
import type { RrhhDepartment } from '@/modules/rrhh/types'

const AVATAR_LIMIT = 5

function DepartmentCard({
  dept,
  expanded,
  onToggle,
}: {
  dept: RrhhDepartment
  expanded: boolean
  onToggle: (name: string) => void
}) {
  const { t } = useTranslation()

  const shown = dept.employees.slice(0, AVATAR_LIMIT)
  const overflow = dept.employees.length - shown.length

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base truncate">{dept.name}</CardTitle>
        <Badge variant="secondary" className="shrink-0 gap-1">
          <Users className="h-3 w-3" />
          {dept.headcount}
        </Badge>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {shown.map((emp) => (
              <RrhhAvatar key={emp.id} employee={emp} size="sm" className="ring-2 ring-card" />
            ))}
          </div>
          {overflow > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
              +{overflow}
            </span>
          )}
        </div>

        {dept.divisions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t('rrhh.departments.divisions')}
            </span>
            {dept.divisions.map((d) => (
              <Badge key={d} variant="outline" className="font-normal">
                {d}
              </Badge>
            ))}
          </div>
        )}

        {dept.locations.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {t('rrhh.departments.locations')}
            </span>
            {dept.locations.map((l) => (
              <Badge key={l} variant="outline" className="font-normal">
                {l}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-auto border-t border-border pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start px-2 text-muted-foreground"
            onClick={() => onToggle(dept.name)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="mr-1 h-4 w-4" />
            ) : (
              <ChevronRight className="mr-1 h-4 w-4" />
            )}
            {t('rrhh.departments.viewMembers')}
          </Button>

          {expanded && (
            <ul className="mt-2 space-y-1">
              {dept.employees.map((emp) => (
                <li key={emp.id}>
                  <Link
                    to={`/rrhh/directory/${emp.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary"
                  >
                    <RrhhAvatar employee={emp} size="sm" />
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'truncate text-sm font-medium text-foreground transition-colors',
                          'hover:text-emerald-600',
                        )}
                      >
                        {emp.displayName}
                      </p>
                      {emp.jobTitle && (
                        <p className="truncate text-xs text-muted-foreground">{emp.jobTitle}</p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function Departments() {
  const { t } = useTranslation()
  const { employees, syncing, connected, sync, lastSync } = useRrhhDirectory()

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const header = (
    <RrhhPageHeader
      title={t('rrhh.departments.title')}
      subtitle={t('rrhh.departments.subtitle')}
      syncing={syncing}
      onSync={connected ? sync : undefined}
      lastSync={lastSync}
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
        <EmptyStateCard
          title={t('rrhh.departments.empty')}
          hint={t('rrhh.departments.emptyHint')}
        />
      </div>
    )
  }

  const departments = buildDepartments(employees)

  return (
    <div className="space-y-6">
      {header}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => (
          <DepartmentCard
            key={dept.name}
            dept={dept}
            expanded={expanded.has(dept.name)}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  )
}
