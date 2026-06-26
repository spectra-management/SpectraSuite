import { useTranslation } from 'react-i18next'
import { Loader2, AlertTriangle, Lock, FileText, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { formatDate } from '@/shared/lib/utils'
import {
  useRrhhEmergencyContacts,
  useRrhhCompensation,
  useRrhhDocuments,
} from '@/modules/rrhh/hooks/useRrhhEmployeeDetail'
import {
  payRateDisplay,
  compRateDisplay,
  maskNationalId,
  tenureFrom,
} from '@/modules/rrhh/lib/format'
import type { RrhhEmployee } from '@/modules/rrhh/types'

/* ----------------------------- shared bits ------------------------------ */

/** A muted-label / value pair inside a definition list. */
export function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    // min-w-0 lets the cell shrink inside the grid; break-words wraps long unbreakable
    // values (e.g. emails) instead of overflowing into the neighbouring column.
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm font-medium text-foreground${mono ? ' font-mono' : ''}`}>{value}</dd>
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function TabLoading() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t('rrhh.profile.tabLoading')}
    </div>
  )
}

function TabError({ message }: { message?: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-amber-500" />
      <p className="text-sm font-medium text-foreground">{t('rrhh.profile.tabError')}</p>
      {message && <p className="max-w-md text-xs text-muted-foreground">{message}</p>}
    </div>
  )
}

function TabEmpty({ message }: { message: string }) {
  return <p className="py-6 text-sm text-muted-foreground">{message}</p>
}

/** Shown in place of a sensitive tab's body if it is somehow reached without access. */
export function RestrictedCard() {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
          <Lock className="h-6 w-6" />
        </span>
        <p className="text-sm font-medium text-foreground">{t('rrhh.profile.restrictedTitle')}</p>
        <p className="max-w-md text-xs text-muted-foreground">{t('rrhh.profile.restrictedDesc')}</p>
      </CardContent>
    </Card>
  )
}

/* ------------------------------- Personal ------------------------------- */

export function PersonalTab({
  employee,
  canViewSensitive,
}: {
  employee: RrhhEmployee
  canViewSensitive: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SectionCard title={t('rrhh.profile.personalInfo')}>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label={t('rrhh.profile.preferredName')} value={employee.preferredName || '—'} />
          <Field label={t('rrhh.profile.gender')} value={employee.gender || '—'} />
          <Field label={t('rrhh.profile.dateOfBirth')} value={formatDate(employee.dateOfBirth)} />
          <Field label={t('rrhh.profile.maritalStatus')} value={employee.maritalStatus || '—'} />
          <Field label={t('rrhh.profile.nationality')} value={employee.nationality || '—'} />
          <Field
            label={t('rrhh.profile.nationalId')}
            value={maskNationalId(employee.ssn)}
            mono
          />
        </dl>
        {!canViewSensitive && employee.ssn && (
          <p className="mt-3 text-xs text-muted-foreground">{t('rrhh.profile.idMaskedHint')}</p>
        )}
      </SectionCard>

      <SectionCard title={t('rrhh.profile.contact')}>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label={t('rrhh.profile.workEmail')} value={employee.workEmail || '—'} />
          <Field label={t('rrhh.profile.personalEmail')} value={employee.personalEmail || '—'} />
          <Field label={t('rrhh.profile.mobilePhone')} value={employee.mobilePhone || '—'} />
          <Field label={t('rrhh.profile.homePhone')} value={employee.homePhone || '—'} />
          <Field label={t('rrhh.profile.workPhone')} value={employee.workPhone || '—'} />
        </dl>
      </SectionCard>

      <SectionCard title={t('rrhh.profile.addressInfo')}>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label={t('rrhh.profile.address')} value={employee.address || '—'} />
          <Field label={t('rrhh.profile.address2')} value={employee.address2 || '—'} />
          <Field label={t('rrhh.profile.city')} value={employee.city || '—'} />
          <Field label={t('rrhh.profile.state')} value={employee.state || '—'} />
          <Field label={t('rrhh.profile.zipcode')} value={employee.zipcode || '—'} />
          <Field label={t('rrhh.profile.country')} value={employee.country || '—'} />
        </dl>
      </SectionCard>
    </div>
  )
}

/* --------------------------------- Job ---------------------------------- */

export function JobTab({
  employee,
  directReports,
}: {
  employee: RrhhEmployee
  directReports: number
}) {
  const { t } = useTranslation()
  const tenure = tenureFrom(employee.hireDate)
  const tenureLabel = tenure
    ? `${t('rrhh.profile.years', { count: tenure.years })} ${t('rrhh.profile.months', { count: tenure.months })}`
    : '—'

  return (
    <SectionCard title={t('rrhh.profile.jobInfo')}>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label={t('rrhh.profile.jobTitle')} value={employee.jobTitle || '—'} />
        <Field label={t('rrhh.profile.department')} value={employee.department || '—'} />
        <Field label={t('rrhh.profile.division')} value={employee.division || '—'} />
        <Field label={t('rrhh.profile.location')} value={employee.location || '—'} />
        <Field label={t('rrhh.profile.hireDate')} value={formatDate(employee.hireDate)} />
        <Field label={t('rrhh.profile.tenure')} value={tenureLabel} />
        <Field label={t('rrhh.profile.supervisor')} value={employee.supervisor || '—'} />
        <Field label={t('rrhh.profile.directReports')} value={String(directReports)} />
        <Field
          label={t('rrhh.profile.status')}
          value={t(`rrhh.status.${employee.status.toLowerCase()}`)}
        />
        <Field label={t('rrhh.profile.employeeNumber')} value={employee.employeeNumber || '—'} />
        <Field label={t('rrhh.profile.employeeId')} value={employee.id} mono />
      </dl>
    </SectionCard>
  )
}

/* ----------------------------- Compensation ----------------------------- */

export function CompensationTab({ employee, enabled }: { employee: RrhhEmployee; enabled: boolean }) {
  const { t } = useTranslation()
  const { data: history, loading, error } = useRrhhCompensation(employee.id, enabled)

  const current = history[0]

  return (
    <div className="space-y-6">
      <SectionCard title={t('rrhh.profile.compensation')}>
        {loading && history.length === 0 ? (
          <TabLoading />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field
                label={t('rrhh.profile.payRate')}
                value={
                  current
                    ? compRateDisplay(current)
                    : payRateDisplay(employee) || t('rrhh.profile.notSet')
                }
              />
              <Field
                label={t('rrhh.profile.payType')}
                value={current?.type || employee.payType || '—'}
              />
              <Field
                label={t('rrhh.profile.payPer')}
                value={current?.paidPer || employee.payPer || '—'}
              />
              <Field label={t('rrhh.profile.paySchedule')} value={employee.paySchedule || '—'} />
              <Field label={t('rrhh.profile.payGroup')} value={employee.payGroup || '—'} />
              <Field label={t('rrhh.profile.exempt')} value={employee.exempt || '—'} />
              {current?.startDate && (
                <Field label={t('rrhh.profile.effectiveDate')} value={formatDate(current.startDate)} />
              )}
            </dl>
            {/* A failed comp-table fetch is non-fatal: we still show the report-derived rate above. */}
            {error && history.length === 0 && (
              <p className="mt-3 text-xs text-muted-foreground">{t('rrhh.profile.compHistoryUnavailable')}</p>
            )}
          </>
        )}
      </SectionCard>

      {history.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('rrhh.profile.payHistory')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('rrhh.profile.effectiveDate')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('rrhh.profile.payRate')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('rrhh.profile.payType')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t('rrhh.profile.payReason')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.map((c) => (
                    <tr key={c.id} className="hover:bg-secondary transition-colors">
                      <td className="px-6 py-3 text-muted-foreground">{formatDate(c.startDate)}</td>
                      <td className="px-6 py-3 font-medium text-foreground">{compRateDisplay(c)}</td>
                      <td className="px-6 py-3 text-muted-foreground">{c.type || '—'}</td>
                      <td className="px-6 py-3 text-muted-foreground">{c.reason || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/* ------------------------------- Time off ------------------------------- */

export function TimeOffTab({
  requests,
}: {
  requests: { id: string; typeName: string; start: string; end: string; days: number; status: string }[]
}) {
  const { t } = useTranslation()
  return (
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
                  {['type', 'dates', 'daysLabel', 'status'].map((k) => (
                    <th
                      key={k}
                      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {t(`rrhh.timeOff.${k}`)}
                    </th>
                  ))}
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
        <p className="px-6 pb-4 pt-3 text-xs text-muted-foreground">{t('rrhh.timeOff.note')}</p>
      </CardContent>
    </Card>
  )
}

/* -------------------------- Emergency contacts -------------------------- */

export function EmergencyTab({ employeeId, enabled }: { employeeId: string; enabled: boolean }) {
  const { t } = useTranslation()
  const { data: contacts, loading, error } = useRrhhEmergencyContacts(employeeId, enabled)

  return (
    <SectionCard title={t('rrhh.profile.emergency.title')}>
      {loading ? (
        <TabLoading />
      ) : error ? (
        <TabError message={error} />
      ) : contacts.length === 0 ? (
        <TabEmpty message={t('rrhh.profile.emergency.none')} />
      ) : (
        <div className="space-y-4">
          {contacts.map((c) => (
            <div key={c.id} className="rounded-lg border border-border p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{c.name || '—'}</span>
                {c.relationship && <Badge variant="secondary">{c.relationship}</Badge>}
                {c.isPrimary && <Badge>{t('rrhh.profile.emergency.primary')}</Badge>}
              </div>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label={t('rrhh.profile.mobilePhone')} value={c.mobilePhone || '—'} />
                <Field label={t('rrhh.profile.homePhone')} value={c.homePhone || '—'} />
                <Field label={t('rrhh.profile.workPhone')} value={c.workPhone || '—'} />
                <Field label={t('rrhh.profile.emergency.email')} value={c.email || '—'} />
              </dl>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

/* -------------------------------- Notes --------------------------------- */

export function NotesTab() {
  const { t } = useTranslation()
  return (
    <SectionCard title={t('rrhh.profile.notes.title')}>
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
        <FileText className="h-6 w-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('rrhh.profile.notes.notExposed')}</p>
      </div>
    </SectionCard>
  )
}

/* ------------------------------ Documents ------------------------------- */

export function DocumentsTab({ employeeId, enabled }: { employeeId: string; enabled: boolean }) {
  const { t } = useTranslation()
  const { data: docs, loading, error } = useRrhhDocuments(employeeId, enabled)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          {t('rrhh.profile.documents.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className={docs.length === 0 ? undefined : 'p-0'}>
        {loading ? (
          <TabLoading />
        ) : error ? (
          <TabError message={error} />
        ) : docs.length === 0 ? (
          <TabEmpty message={t('rrhh.profile.documents.none')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary">
                  {['name', 'category', 'date', 'size'].map((k) => (
                    <th
                      key={k}
                      className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {t(`rrhh.profile.documents.${k}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {docs.map((d) => (
                  <tr key={d.id} className="hover:bg-secondary transition-colors">
                    <td className="px-6 py-3">
                      <span className="flex items-center gap-2 font-medium text-foreground">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        {d.name}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{d.category || '—'}</td>
                    <td className="px-6 py-3 text-muted-foreground">{d.dateCreated ? formatDate(d.dateCreated) : '—'}</td>
                    <td className="px-6 py-3 text-muted-foreground">{d.size || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
