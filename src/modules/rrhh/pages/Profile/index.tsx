import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  User,
  Briefcase,
  DollarSign,
  CalendarDays,
  Phone,
  StickyNote,
  Files,
} from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useRrhhDirectory } from '@/modules/rrhh/hooks/useRrhhDirectory'
import { useRrhhTimeOff } from '@/modules/rrhh/hooks/useRrhhTimeOff'
import { useRrhhAccess } from '@/modules/rrhh/lib/permissions'
import { useRrhhPhotos } from '@/modules/rrhh/hooks/useRrhhPhotos'
import { RrhhPhotoEditor } from '@/modules/rrhh/components/RrhhPhotoEditor'
import { RrhhTabBar, type RrhhTab } from '@/modules/rrhh/components/RrhhTabs'
import { NotConnectedCard } from '@/modules/rrhh/components/RrhhStates'
import { buildPhotoProxyUrl } from '@/modules/rrhh/lib/connectors/bamboohr'
import { countryFlag } from '@/modules/rrhh/lib/format'
import type { RrhhEmployee, RrhhEmployeeStatus } from '@/modules/rrhh/types'
import {
  PersonalTab,
  JobTab,
  CompensationTab,
  TimeOffTab,
  EmergencyTab,
  NotesTab,
  DocumentsTab,
  RestrictedCard,
} from './tabs'

function statusVariant(status: RrhhEmployeeStatus): 'default' | 'secondary' | 'destructive' {
  if (status === 'Active') return 'default'
  if (status === 'Inactive') return 'secondary'
  return 'destructive'
}

type TabId =
  | 'personal'
  | 'job'
  | 'compensation'
  | 'timeOff'
  | 'emergency'
  | 'notes'
  | 'documents'

export default function Profile() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const { employees, connected } = useRrhhDirectory()
  const { timeOff } = useRrhhTimeOff()
  const { canViewSensitive, canManagePhotos } = useRrhhAccess()
  const { customUrlFor } = useRrhhPhotos()
  const bamboohr = useSettingsStore((s) => s.bamboohr)

  const [activeTab, setActiveTab] = useState<TabId>('personal')

  const employee: RrhhEmployee | undefined = useMemo(
    () => employees.find((e) => e.id === id),
    [employees, id],
  )
  const directReports = useMemo(
    () => (id ? employees.filter((e) => e.supervisorId === id).length : 0),
    [employees, id],
  )

  const backButton = (
    <Button variant="ghost" size="sm" asChild>
      <Link to="/rrhh/directory">
        <ArrowLeft className="mr-1 h-4 w-4" />
        {t('rrhh.common.back')}
      </Link>
    </Button>
  )

  // Not connected and nothing cached: surface the connect prompt.
  if (!connected && employees.length === 0) {
    return (
      <div className="space-y-6">
        <div>{backButton}</div>
        <NotConnectedCard />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">{t('rrhh.profile.notFound')}</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/rrhh/directory">{t('rrhh.common.back')}</Link>
        </Button>
      </div>
    )
  }

  const requests = timeOff.filter((r) => r.employeeId === id)
  // No apiKey here on purpose — the proxy adds the credential server-side (see
  // buildPhotoProxyUrl / api/bamboohr.ts). The key must never reach a client URL.
  const photoSrc = buildPhotoProxyUrl(bamboohr.subdomain, employee.id, 'large')

  // Tab set — sensitive tabs (Compensation, Documents) are hidden entirely without access.
  const tabs: RrhhTab[] = [
    { id: 'personal', label: t('rrhh.profile.tabs.personal'), icon: User },
    { id: 'job', label: t('rrhh.profile.tabs.job'), icon: Briefcase },
    ...(canViewSensitive
      ? [{ id: 'compensation', label: t('rrhh.profile.tabs.compensation'), icon: DollarSign }]
      : []),
    { id: 'timeOff', label: t('rrhh.profile.tabs.timeOff'), icon: CalendarDays },
    { id: 'emergency', label: t('rrhh.profile.tabs.emergency'), icon: Phone },
    { id: 'notes', label: t('rrhh.profile.tabs.notes'), icon: StickyNote },
    ...(canViewSensitive
      ? [{ id: 'documents', label: t('rrhh.profile.tabs.documents'), icon: Files }]
      : []),
  ]

  // Guard: if a stale active tab is no longer permitted, fall back to Personal.
  const effectiveTab: TabId = tabs.some((tb) => tb.id === activeTab) ? activeTab : 'personal'

  return (
    <div className="max-w-4xl space-y-6">
      <div>{backButton}</div>

      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <RrhhPhotoEditor
              employee={employee}
              proxiedSrc={photoSrc}
              customSrc={customUrlFor(employee.id)}
              canEdit={canManagePhotos}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold text-foreground">{employee.displayName}</h1>
                <Badge variant={statusVariant(employee.status)}>
                  {t(`rrhh.status.${employee.status.toLowerCase()}`)}
                </Badge>
                <Badge variant="secondary">{t('rrhh.common.readOnly')}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {employee.jobTitle}
                {employee.department ? ` · ${employee.department}` : ''}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="mr-1">{countryFlag(employee.country)}</span>
                {employee.location || employee.country || '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <RrhhTabBar tabs={tabs} active={effectiveTab} onChange={(v) => setActiveTab(v as TabId)} />

      {/* Tab content (each tab owns its own loading/error state). */}
      {effectiveTab === 'personal' && (
        <PersonalTab employee={employee} canViewSensitive={canViewSensitive} />
      )}
      {effectiveTab === 'job' && <JobTab employee={employee} directReports={directReports} />}
      {effectiveTab === 'compensation' &&
        (canViewSensitive ? (
          <CompensationTab employee={employee} enabled={effectiveTab === 'compensation'} />
        ) : (
          <RestrictedCard />
        ))}
      {effectiveTab === 'timeOff' && <TimeOffTab requests={requests} />}
      {effectiveTab === 'emergency' && (
        <EmergencyTab employeeId={employee.id} enabled={effectiveTab === 'emergency'} />
      )}
      {effectiveTab === 'notes' && <NotesTab />}
      {effectiveTab === 'documents' &&
        (canViewSensitive ? (
          <DocumentsTab employeeId={employee.id} enabled={effectiveTab === 'documents'} />
        ) : (
          <RestrictedCard />
        ))}
    </div>
  )
}
