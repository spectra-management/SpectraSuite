import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import type { BillingClient, ClientEmployee, BillingMethod, TitleRate } from '@/modules/facturacion/lib/types'
import { findTitleRate } from '@/modules/facturacion/lib/rates'

export interface OverrideValues {
  method: BillingMethod | null
  baseRateOverride: number | null
  otRateOverride: number | null
  fixedAmount: number | null
  percentageRate: number | null
}

const numOrNull = (s: string): number | null => {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function AssignmentOverrideDialog({
  open,
  onOpenChange,
  client,
  assignment,
  employeeName,
  jobTitle,
  titleRates,
  onSave,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  client: BillingClient
  assignment: ClientEmployee
  employeeName: string
  jobTitle: string
  titleRates: TitleRate[]
  onSave: (values: OverrideValues) => void
}) {
  const { t } = useTranslation()
  const [method, setMethod] = useState<string>('inherit')
  const [base, setBase] = useState('')
  const [ot, setOt] = useState('')
  const [fixed, setFixed] = useState('')
  const [pct, setPct] = useState('')

  useEffect(() => {
    if (!open) return
    setMethod(assignment.method ?? 'inherit')
    setBase(assignment.baseRateOverride?.toString() ?? '')
    setOt(assignment.otRateOverride?.toString() ?? '')
    setFixed(assignment.fixedAmount?.toString() ?? '')
    setPct(assignment.percentageRate?.toString() ?? '')
  }, [open, assignment])

  const effectiveMethod: BillingMethod = method === 'inherit' ? client.defaultMethod : (method as BillingMethod)
  const titleRate = findTitleRate(titleRates, client.id, jobTitle)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{employeeName}</DialogTitle>
          <DialogDescription>{jobTitle || t('facturacion.assign.noTitle')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label>{t('facturacion.assign.method')}</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">{t('facturacion.assign.inheritMethod', { method: t(`facturacion.method.${client.defaultMethod}`) })}</SelectItem>
                <SelectItem value="hour">{t('facturacion.method.hour')}</SelectItem>
                <SelectItem value="fixed">{t('facturacion.method.fixed')}</SelectItem>
                <SelectItem value="percentage">{t('facturacion.method.percentage')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {effectiveMethod === 'hour' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('facturacion.assign.baseRateOverride')}</Label>
                <Input inputMode="decimal" value={base} onChange={(e) => setBase(e.target.value)}
                  placeholder={titleRate ? titleRate.baseRate.toString() : t('facturacion.assign.noTitleRate')} />
                <p className="mt-1 text-[11px] text-muted-foreground">{t('facturacion.assign.titleRateIs', { rate: titleRate ? titleRate.baseRate : '—' })}</p>
              </div>
              <div>
                <Label>{t('facturacion.assign.otRateOverride')}</Label>
                <Input inputMode="decimal" value={ot} onChange={(e) => setOt(e.target.value)}
                  placeholder={titleRate ? titleRate.otRate.toString() : t('facturacion.assign.noTitleRate')} />
                <p className="mt-1 text-[11px] text-muted-foreground">{t('facturacion.assign.titleRateIs', { rate: titleRate ? titleRate.otRate : '—' })}</p>
              </div>
            </div>
          )}

          {effectiveMethod === 'fixed' && (
            <div>
              <Label>{t('facturacion.assign.fixedAmount')}</Label>
              <Input inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} />
            </div>
          )}

          {effectiveMethod === 'percentage' && (
            <div>
              <Label>{t('facturacion.assign.percentageRate')}</Label>
              <Input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="15" />
              <p className="mt-1 text-[11px] text-muted-foreground">{t('facturacion.assign.percentageHint')}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={() => {
            onSave({
              method: method === 'inherit' ? null : (method as BillingMethod),
              baseRateOverride: numOrNull(base),
              otRateOverride: numOrNull(ot),
              fixedAmount: numOrNull(fixed),
              percentageRate: numOrNull(pct),
            })
            onOpenChange(false)
          }}>{t('common.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
