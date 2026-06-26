import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldOff } from 'lucide-react'
import { Switch } from '@/shared/components/ui/switch'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Badge } from '@/shared/components/ui/badge'
import { usePayrollSettingsStore } from '@/shared/store/payrollSettingsStore'

/**
 * Per-employee tax-exemption control, shared by the Nómina and RRHH employee profiles.
 *
 * A flagged employee has NO statutory deductions withheld in payroll (ISR + TSS all waived;
 * custom deductions still apply). The reason is free text. Backed by the shared
 * `payrollSettingsStore` (localStorage + Supabase), so both profiles and the payroll engine
 * see the same value. When `canEdit` is false it renders read-only.
 */
export function TaxExemptionControl({
  employeeId,
  canEdit,
}: {
  employeeId: string
  canEdit: boolean
}) {
  const { t } = useTranslation()
  const setting = usePayrollSettingsStore((s) => s.byId[employeeId])
  const setTaxExempt = usePayrollSettingsStore((s) => s.setTaxExempt)

  const exempt = setting?.taxExempt === true
  const savedReason = setting?.taxExemptReason ?? ''

  // Local draft of the reason so typing is smooth; persisted on blur. Reset when the
  // employee or the stored value changes.
  const [reason, setReason] = useState(savedReason)
  useEffect(() => {
    setReason(savedReason)
  }, [employeeId, savedReason])

  // Read-only view for users without edit access.
  if (!canEdit) {
    return (
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldOff className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{t('taxExemption.title')}</span>
          </div>
          <Badge variant={exempt ? 'destructive' : 'secondary'}>
            {exempt ? t('taxExemption.exemptYes') : t('taxExemption.exemptNo')}
          </Badge>
        </div>
        {exempt && (
          <p className="mt-2 text-sm text-muted-foreground">
            {savedReason || t('taxExemption.noReason')}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <ShieldOff className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div>
            <Label htmlFor={`tax-exempt-${employeeId}`} className="text-sm font-medium text-foreground">
              {t('taxExemption.toggle')}
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('taxExemption.description')}</p>
          </div>
        </div>
        <Switch
          id={`tax-exempt-${employeeId}`}
          checked={exempt}
          onCheckedChange={(checked) => {
            if (!checked) setReason('')
            setTaxExempt(employeeId, checked, checked ? reason : '')
          }}
        />
      </div>

      {exempt && (
        <div className="mt-3 space-y-1.5">
          <Label htmlFor={`tax-exempt-reason-${employeeId}`} className="text-xs text-muted-foreground">
            {t('taxExemption.reasonLabel')}
          </Label>
          <Textarea
            id={`tax-exempt-reason-${employeeId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => {
              if (reason !== savedReason) setTaxExempt(employeeId, true, reason)
            }}
            placeholder={t('taxExemption.reasonPlaceholder')}
            rows={2}
          />
        </div>
      )}
    </div>
  )
}
