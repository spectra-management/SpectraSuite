import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

export interface BonusInput {
  employeeId: string
  employeeName: string
  title: string
  label: string
  quantity: number
  amount: number
}

export function BonusLineDialog({
  open,
  onOpenChange,
  employees,
  suggestions,
  onAdd,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  employees: { id: string; name: string; title: string }[]
  suggestions: string[]
  onAdd: (input: BonusInput) => void
}) {
  const { t } = useTranslation()
  const [employeeId, setEmployeeId] = useState('')
  const [label, setLabel] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [amount, setAmount] = useState('')

  useEffect(() => {
    if (open) { setEmployeeId(employees[0]?.id ?? ''); setLabel(''); setQuantity('1'); setAmount('') }
  }, [open, employees])

  const valid = employeeId && label.trim() && Number(amount) > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('facturacion.bonus.add')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label>{t('facturacion.lines.employee')}</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger><SelectValue placeholder={t('facturacion.assign.selectEmployee')} /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}{e.title ? ` — ${e.title}` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('facturacion.bonus.label')}</Label>
            <Input list="bonus-suggestions" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('facturacion.bonus.labelPlaceholder')} />
            <datalist id="bonus-suggestions">
              {suggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t('facturacion.bonus.quantity')}</Label>
              <Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div>
              <Label>{t('facturacion.bonus.amount')}</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">{t('facturacion.bonus.amountHint')}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button disabled={!valid} onClick={() => {
            const emp = employees.find((e) => e.id === employeeId)
            onAdd({
              employeeId,
              employeeName: emp?.name ?? employeeId,
              title: emp?.title ?? '',
              label: label.trim(),
              quantity: Number(quantity) > 0 ? Number(quantity) : 1,
              amount: Number(amount),
            })
            onOpenChange(false)
          }}>{t('common.add')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
