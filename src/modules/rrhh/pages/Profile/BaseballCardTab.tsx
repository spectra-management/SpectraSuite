import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Loader2, Pencil, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useBaseballCardStore } from '@/shared/store/baseballCardStore'
import { toast } from '@/shared/hooks/useToast'
import { getInitials } from '@/shared/lib/utils'
import { generatePdfBlob, downloadBlob } from '@/shared/lib/pdf'
import {
  resolveBaseballCard,
  formatMonthDay,
  formatMonthYear,
  type BaseballCardOverrides,
  type HrCardSource,
} from '@/shared/lib/baseballCard'
import type { RrhhEmployee } from '@/modules/rrhh/types'

const linesToArray = (text: string): string[] => text.split('\n').map((s) => s.trim()).filter(Boolean)

function safeFilePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'card'
}

export function BaseballCardTab({
  employee,
  canEdit,
  photoSrc,
}: {
  employee: RrhhEmployee
  canEdit: boolean
  photoSrc: string
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const company = useSettingsStore((s) => s.company)
  const stored = useBaseballCardStore((s) => s.byId[employee.id])
  const setCard = useBaseballCardStore((s) => s.setCard)

  const hr: HrCardSource = useMemo(
    () => ({
      fullName: employee.displayName,
      nickName: employee.preferredName,
      dateOfBirth: employee.dateOfBirth,
      hireDate: employee.hireDate,
      jobTitle: employee.jobTitle,
    }),
    [employee],
  )

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<BaseballCardOverrides>(stored ?? {})
  const [downloading, setDownloading] = useState(false)

  // Reset the draft when the employee or stored value changes.
  useEffect(() => {
    setDraft(stored ?? {})
    setEditing(false)
  }, [employee.id, stored])

  // While editing, the preview reflects the draft; otherwise the stored overrides.
  const resolved = useMemo(
    () => resolveBaseballCard(hr, editing ? draft : stored ?? {}, lang),
    [hr, draft, stored, editing, lang],
  )

  const initials = getInitials(employee.firstName, employee.lastName)

  const save = () => {
    setCard(employee.id, draft)
    setEditing(false)
    toast({ variant: 'success', title: t('rrhh.baseballCard.saved') })
  }

  const download = async () => {
    setDownloading(true)
    try {
      const { BaseballCardDocument } = await import('@/modules/rrhh/lib/BaseballCardDocument')
      const labels = {
        fullName: t('rrhh.baseballCard.fullName'),
        nickName: t('rrhh.baseballCard.nickName'),
        dob: t('rrhh.baseballCard.dob'),
        spectraStart: t('rrhh.baseballCard.spectraStart'),
        accountName: t('rrhh.baseballCard.accountName'),
        accountStart: t('rrhh.baseballCard.accountStart'),
        jobTitle: t('rrhh.baseballCard.jobTitle'),
        jobHistory: t('rrhh.baseballCard.jobHistory'),
        education: t('rrhh.baseballCard.education'),
        hobbies: t('rrhh.baseballCard.hobbies'),
        funFacts: t('rrhh.baseballCard.funFacts'),
        leadershipStyle: t('rrhh.baseballCard.leadershipStyle'),
        goals: t('rrhh.baseballCard.goals'),
      }
      const blob = await generatePdfBlob(
        <BaseballCardDocument
          card={resolved}
          labels={labels}
          companyName={company.name || 'Spectra'}
          logoSrc={company.logoBase64 || undefined}
          photoSrc={photoSrc || undefined}
          initials={initials}
        />,
      )
      downloadBlob(blob, `baseball_card_${safeFilePart(resolved.fullName)}.pdf`)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: t('rrhh.baseballCard.downloadFailed'),
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        {canEdit && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {t('rrhh.baseballCard.edit')}
          </Button>
        )}
        {canEdit && editing && (
          <Button size="sm" onClick={save}>
            <Check className="mr-1.5 h-3.5 w-3.5" />
            {t('rrhh.baseballCard.save')}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={download} disabled={downloading}>
          {downloading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
          {t('rrhh.baseballCard.downloadPdf')}
        </Button>
      </div>

      {/* Preview */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-center gap-2">
            {company.logoBase64 ? (
              <img src={company.logoBase64} alt="" className="h-7 w-7 object-contain" />
            ) : null}
            <span className="text-lg font-bold text-foreground">{company.name || 'Spectra'}</span>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            {/* Left: fields */}
            <div className="flex-[2] rounded-lg border border-border p-4 text-sm">
              <p>
                <span className="font-semibold">{t('rrhh.baseballCard.fullName')}:</span> {resolved.fullName || '—'}
                {resolved.nickName ? <>{'   '}<span className="font-semibold">{t('rrhh.baseballCard.nickName')}:</span> {resolved.nickName}</> : null}
              </p>
              {resolved.dobMonthDay && <p className="mt-2"><span className="font-semibold">{t('rrhh.baseballCard.dob')}:</span> {resolved.dobMonthDay}</p>}
              {resolved.spectraStartDate && <p className="mt-2"><span className="font-semibold">{t('rrhh.baseballCard.spectraStart')}:</span> {resolved.spectraStartDate}</p>}
              {(resolved.accountName || resolved.accountStartDate) && (
                <p className="mt-1">
                  {resolved.accountName && <><span className="font-semibold">{t('rrhh.baseballCard.accountName')}:</span> {resolved.accountName}{'   '}</>}
                  {resolved.accountStartDate && <><span className="font-semibold">{t('rrhh.baseballCard.accountStart')}:</span> {resolved.accountStartDate}</>}
                </p>
              )}
              {resolved.jobTitle && <p className="mt-1"><span className="font-semibold">{t('rrhh.baseballCard.jobTitle')}:</span> {resolved.jobTitle}</p>}

              {resolved.jobHistory.length > 0 && (
                <div className="mt-3">
                  <p className="font-semibold">{t('rrhh.baseballCard.jobHistory')}:</p>
                  <ul className="ml-4 list-disc">{resolved.jobHistory.map((j, i) => <li key={i}>{j}</li>)}</ul>
                </div>
              )}
              {resolved.education && <p className="mt-3"><span className="font-semibold">{t('rrhh.baseballCard.education')}:</span> {resolved.education}</p>}
              {resolved.hobbies.length > 0 && <p className="mt-3"><span className="font-semibold">{t('rrhh.baseballCard.hobbies')}:</span> {resolved.hobbies.join(', ')}</p>}
              {resolved.funFacts.length > 0 && <p className="mt-3"><span className="font-semibold">{t('rrhh.baseballCard.funFacts')}:</span> {resolved.funFacts.join(', ')}</p>}
              {resolved.leadershipStyle && <p className="mt-3"><span className="font-semibold">{t('rrhh.baseballCard.leadershipStyle')}:</span> {resolved.leadershipStyle}</p>}
            </div>

            {/* Right: photo + goals */}
            <div className="flex-1 space-y-3">
              {photoSrc ? (
                <img src={photoSrc} alt="" className="h-40 w-full rounded-lg object-cover" />
              ) : (
                <div className="flex h-40 w-full items-center justify-center rounded-lg bg-emerald-100 text-3xl font-bold text-emerald-700">
                  {initials}
                </div>
              )}
              {resolved.goals.length > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-center font-bold">{t('rrhh.baseballCard.goals')}:</p>
                  <ul className="ml-4 list-disc text-sm">{resolved.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      {canEdit && editing && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('rrhh.baseballCard.editTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">{t('rrhh.baseballCard.editHint')}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('rrhh.baseballCard.fullName')} placeholder={hr.fullName}
                value={draft.fullName ?? ''} onChange={(v) => setDraft((d) => ({ ...d, fullName: v }))} />
              <Field label={t('rrhh.baseballCard.nickName')} placeholder={hr.nickName}
                value={draft.nickName ?? ''} onChange={(v) => setDraft((d) => ({ ...d, nickName: v }))} />
              <Field label={t('rrhh.baseballCard.dob')} placeholder={formatMonthDay(hr.dateOfBirth, lang)}
                value={draft.dobMonthDay ?? ''} onChange={(v) => setDraft((d) => ({ ...d, dobMonthDay: v }))} />
              <Field label={t('rrhh.baseballCard.spectraStart')} placeholder={formatMonthYear(hr.hireDate, lang)}
                value={draft.spectraStartDate ?? ''} onChange={(v) => setDraft((d) => ({ ...d, spectraStartDate: v }))} />
              <Field label={t('rrhh.baseballCard.accountName')}
                value={draft.accountName ?? ''} onChange={(v) => setDraft((d) => ({ ...d, accountName: v }))} />
              <Field label={t('rrhh.baseballCard.accountStart')}
                value={draft.accountStartDate ?? ''} onChange={(v) => setDraft((d) => ({ ...d, accountStartDate: v }))} />
              <Field label={t('rrhh.baseballCard.jobTitle')} placeholder={hr.jobTitle}
                value={draft.jobTitle ?? ''} onChange={(v) => setDraft((d) => ({ ...d, jobTitle: v }))} />
              <Field label={t('rrhh.baseballCard.leadershipStyle')}
                value={draft.leadershipStyle ?? ''} onChange={(v) => setDraft((d) => ({ ...d, leadershipStyle: v }))} />
            </div>

            <ListField label={t('rrhh.baseballCard.jobHistory')} hint={t('rrhh.baseballCard.onePerLine')}
              value={draft.jobHistory ?? []} onChange={(arr) => setDraft((d) => ({ ...d, jobHistory: arr }))} />
            <Field label={t('rrhh.baseballCard.education')}
              value={draft.education ?? ''} onChange={(v) => setDraft((d) => ({ ...d, education: v }))} />
            <ListField label={t('rrhh.baseballCard.hobbies')} hint={t('rrhh.baseballCard.onePerLine')}
              value={draft.hobbies ?? []} onChange={(arr) => setDraft((d) => ({ ...d, hobbies: arr }))} />
            <ListField label={t('rrhh.baseballCard.funFacts')} hint={t('rrhh.baseballCard.onePerLine')}
              value={draft.funFacts ?? []} onChange={(arr) => setDraft((d) => ({ ...d, funFacts: arr }))} />
            <ListField label={t('rrhh.baseballCard.goals')} hint={t('rrhh.baseballCard.onePerLine')}
              value={draft.goals ?? []} onChange={(arr) => setDraft((d) => ({ ...d, goals: arr }))} />

            <div className="flex justify-end">
              <Button size="sm" onClick={save}>
                <Check className="mr-1.5 h-3.5 w-3.5" />
                {t('rrhh.baseballCard.save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Field({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function ListField({
  label, hint, value, onChange,
}: { label: string; hint: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label} <span className="opacity-60">· {hint}</span></Label>
      <Textarea
        rows={3}
        value={value.join('\n')}
        onChange={(e) => onChange(linesToArray(e.target.value))}
      />
    </div>
  )
}
