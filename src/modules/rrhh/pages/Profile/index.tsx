import { useTranslation } from 'react-i18next'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { formatDate } from '@/shared/lib/utils'
import { useRrhhDirectory } from '@/modules/rrhh/hooks/useRrhhDirectory'
import { useRrhhTimeOff } from '@/modules/rrhh/hooks/useRrhhTimeOff'
import { RrhhAvatar } from '@/modules/rrhh/components/RrhhAvatar'
import { NotConnectedCard } from '@/modules/rrhh/components/RrhhStates'
import { countryFlag, payRateDisplay, tenureFrom } from '@/modules/rrhh/lib/format'
import type { RrhhEmployee, RrhhEmployeeStatus } from '@/modules/rrhh/types'

function statusVariant(status: RrhhEmployeeStatus): 'default' | 'secondary' | 'destructive' {
  if (status === 'Active') return 'default'
  if (status === 'Inactive') return 'secondary'
  return 'destructive'
}

/** A muted-label / value pair inside a definition list. */
function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 text-sm font-medium text-foreground${mono ? ' font-mono' : ''}`}>{value}</dd>
    </div>
  )
}

export default function Profile() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation()
  const { employees, connected } = useRrhhDirectory()
  const { timeOff } = useRrhhTimeOff()

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

  const employee: RrhhEmployee | undefined = employees.find((e) => e.id === id)

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
  const tenure = tenureFrom(employee.hireDate)
  const tenureLabel = tenure
    ? `${t('rrhh.profile.years', { count: tenure.years })} ${t('rrhh.profile.months', { count: tenure.months })}`
    : '—'

  return (
    <div className="max-w-3xl space-y-6">
      <div>{backButton}</div>

      {/* Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <RrhhAvatar employee={employee} size="lg" />
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
                {employee.country || '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('rrhh.profile.jobInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label={t('rrhh.profile.jobTitle')} value={employee.jobTitle || '—'} />
            <Field label={t('rrhh.profile.department')} value={employee.department || '—'} />
            <Field label={t('rrhh.profile.division')} value={employee.division || '—'} />
            <Field label={t('rrhh.profile.location')} value={employee.location || '—'} />
            <Field label={t('rrhh.profile.hireDate')} value={formatDate(employee.hireDate)} />
            <Field label={t('rrhh.profile.tenure')} value={tenureLabel} />
            <Field label={t('rrhh.profile.supervisor')} value={employee.supervisor || '—'} />
            <Field label={t('rrhh.profile.status')} value={t(`rrhh.status.${employee.status.toLowerCase()}`)} />
          </dl>
        </CardContent>
      </Card>

      {/* Compensation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('rrhh.profile.compensation')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label={t('rrhh.profile.payRate')} value={payRateDisplay(employee) || t('rrhh.profile.notSet')} />
            <Field label={t('rrhh.profile.payType')} value={employee.payType || '—'} />
            <Field label={t('rrhh.profile.employeeNumber')} value={employee.employeeNumber || '—'} />
            <Field label={t('rrhh.profile.employeeId')} value={employee.id} mono />
          </dl>
        </CardContent>
      </Card>

      {/* Personal information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('rrhh.profile.personalInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label={t('rrhh.profile.preferredName')} value={employee.preferredName || '—'} />
            <Field label={t('rrhh.profile.gender')} value={employee.gender || '—'} />
            <Field label={t('rrhh.profile.dateOfBirth')} value={formatDate(employee.dateOfBirth)} />
            <Field label={t('rrhh.profile.maritalStatus')} value={employee.maritalStatus || '—'} />
            <Field label={t('rrhh.profile.nationality')} value={employee.nationality || '—'} />
            <Field label={t('rrhh.profile.country')} value={employee.country || '—'} />
          </dl>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('rrhh.profile.contact')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label={t('rrhh.profile.workEmail')} value={employee.workEmail || '—'} />
            <Field label={t('rrhh.profile.mobilePhone')} value={employee.mobilePhone || '—'} />
            <Field label={t('rrhh.profile.workPhone')} value={employee.workPhone || '—'} />
            <Field label={t('rrhh.profile.city')} value={employee.city || '—'} />
            <Field label={t('rrhh.profile.state')} value={employee.state || '—'} />
            <Field label={t('rrhh.profile.address')} value={employee.address || '—'} />
          </dl>
        </CardContent>
      </Card>

      {/* Time off */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('rrhh.profile.timeOff')}</CardTitle>
        </CardHeader>
        <CardContent className={requests.length === 0 ? undefined : 'p-0'}>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('rrhh.profile.noTimeOff')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary">
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
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-secondary transition-colors">
                      <td className="px-6 py-3 font-medium text-foreground">{r.typeName || '—'}</td>
                      <td className="px-6 py-3 text-muted-foreground">
                        {formatDate(r.start)} – {formatDate(r.end)}
                      </td>
                      <td className="px-6 py-3 text-muted-foreground">{t('rrhh.timeOff.days', { count: r.days })}</td>
                      <td className="px-6 py-3 text-muted-foreground">{r.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
