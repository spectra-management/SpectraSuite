import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import type { BillingClient, BillingMethod } from '@/modules/facturacion/lib/types'

export interface ClientFormValues {
  name: string
  contactName: string
  contactEmail: string
  contactPhone: string
  billingAddress: string
  remitToName: string
  remitToAddress: string
  remitToDetails: string
  invoicePrefix: string
  defaultMethod: BillingMethod
  currencyCountry: string
  notes: string
}

const empty: ClientFormValues = {
  name: '', contactName: '', contactEmail: '', contactPhone: '', billingAddress: '',
  remitToName: '', remitToAddress: '', remitToDetails: '', invoicePrefix: 'INV',
  defaultMethod: 'hour', currencyCountry: 'United States', notes: '',
}

export function ClientFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: BillingClient
  onSubmit: (values: ClientFormValues) => void
}) {
  const { t } = useTranslation()
  const [v, setV] = useState<ClientFormValues>(empty)

  useEffect(() => {
    if (open) {
      setV(initial ? {
        name: initial.name, contactName: initial.contactName, contactEmail: initial.contactEmail,
        contactPhone: initial.contactPhone, billingAddress: initial.billingAddress,
        remitToName: initial.remitToName, remitToAddress: initial.remitToAddress,
        remitToDetails: initial.remitToDetails, invoicePrefix: initial.invoicePrefix,
        defaultMethod: initial.defaultMethod, currencyCountry: initial.currencyCountry, notes: initial.notes,
      } : empty)
    }
  }, [open, initial])

  const set = <K extends keyof ClientFormValues>(k: K, val: ClientFormValues[K]) => setV((p) => ({ ...p, [k]: val }))
  const valid = v.name.trim().length > 0 && v.invoicePrefix.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? t('facturacion.clients.editClient') : t('facturacion.clients.newClient')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>{t('facturacion.clients.name')} *</Label>
            <Input value={v.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div>
            <Label>{t('facturacion.clients.contactName')}</Label>
            <Input value={v.contactName} onChange={(e) => set('contactName', e.target.value)} />
          </div>
          <div>
            <Label>{t('facturacion.clients.contactEmail')}</Label>
            <Input type="email" value={v.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} />
          </div>
          <div>
            <Label>{t('facturacion.clients.contactPhone')}</Label>
            <Input value={v.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} />
          </div>
          <div>
            <Label>{t('facturacion.clients.invoicePrefix')} *</Label>
            <Input value={v.invoicePrefix} onChange={(e) => set('invoicePrefix', e.target.value.toUpperCase())} placeholder="RM" />
          </div>
          <div className="sm:col-span-2">
            <Label>{t('facturacion.clients.billingAddress')}</Label>
            <Textarea rows={2} value={v.billingAddress} onChange={(e) => set('billingAddress', e.target.value)} />
          </div>
          <div>
            <Label>{t('facturacion.clients.defaultMethod')}</Label>
            <Select value={v.defaultMethod} onValueChange={(val) => set('defaultMethod', val as BillingMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">{t('facturacion.method.hour')}</SelectItem>
                <SelectItem value="fixed">{t('facturacion.method.fixed')}</SelectItem>
                <SelectItem value="percentage">{t('facturacion.method.percentage')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('facturacion.clients.currency')}</Label>
            {/* Billing/invoicing is always USD. */}
            <div className="flex h-10 items-center rounded-lg border border-border bg-secondary/40 px-3 text-sm text-muted-foreground">
              USD ($)
            </div>
          </div>
          <div className="sm:col-span-2 mt-1 rounded-lg border border-border bg-secondary/40 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('facturacion.clients.remitTo')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>{t('facturacion.clients.remitToName')}</Label>
                <Input value={v.remitToName} onChange={(e) => set('remitToName', e.target.value)} />
              </div>
              <div>
                <Label>{t('facturacion.clients.remitToAddress')}</Label>
                <Input value={v.remitToAddress} onChange={(e) => set('remitToAddress', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>{t('facturacion.clients.remitToDetails')}</Label>
                <Textarea rows={2} value={v.remitToDetails} onChange={(e) => set('remitToDetails', e.target.value)} placeholder={t('facturacion.clients.remitToDetailsHint')} />
              </div>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>{t('facturacion.clients.notes')}</Label>
            <Textarea rows={2} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button disabled={!valid} onClick={() => { onSubmit({ ...v, name: v.name.trim(), invoicePrefix: v.invoicePrefix.trim().toUpperCase() }); onOpenChange(false) }}>
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
