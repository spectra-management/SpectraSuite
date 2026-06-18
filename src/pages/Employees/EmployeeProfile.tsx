import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, Trash2, Pencil, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useEmployeesStore } from '@/store/employeesStore'
import { useSettingsStore } from '@/store/settingsStore'
import { usePaymentMethodsStore } from '@/store/paymentMethodsStore'
import { useBankAccountsStore, RD_BANKS } from '@/store/bankAccountsStore'
import { toast } from '@/hooks/useToast'
import { formatCurrency, formatDate, getInitials } from '@/lib/utils'
import { PAYMENT_METHOD_LABELS } from '@/lib/pdf/paystubLabels'
import { VacationInfoSection } from './VacationInfoSection'
import type { CustomDeduction, PaymentMethod } from '@/types'

const BANK_FIELD_LABELS = {
  en: {
    bank: 'Bank',
    accountNumber: 'Account Number',
    note: 'This field is entered manually for now. It will be auto-synced from BambooHR when the integration becomes available.',
  },
  es: {
    bank: 'Banco',
    accountNumber: 'Número de Cuenta',
    note: 'Este campo se ingresa manualmente por ahora. Se sincronizará automáticamente desde BambooHR cuando la integración esté disponible.',
  },
} as const

interface DeductionFormState {
  name: string
  type: 'fixed' | 'percentage'
  amount: string
  recurring: boolean
  active: boolean
}

const EMPTY_FORM: DeductionFormState = {
  name: '',
  type: 'fixed',
  amount: '',
  recurring: true,
  active: true,
}

export default function EmployeeProfile() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const employees = useEmployeesStore((s) => s.employees)
  const addDeduction = useEmployeesStore((s) => s.addDeduction)
  const updateDeduction = useEmployeesStore((s) => s.updateDeduction)
  const removeDeduction = useEmployeesStore((s) => s.removeDeduction)
  const hubstaff = useSettingsStore((s) => s.hubstaff)
  const paymentMethods = usePaymentMethodsStore((s) => s.methods)
  const setPaymentMethod = usePaymentMethodsStore((s) => s.setMethod)
  const bankAccounts = useBankAccountsStore((s) => s.accounts)
  const setBankAccount = useBankAccountsStore((s) => s.setAccount)
  const uiLang = i18n.language?.startsWith('es') ? 'es' : 'en'

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DeductionFormState>(EMPTY_FORM)

  const employee = employees.find((e) => e.id === id)

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Employee not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/nomina/employees">{t('common.back')}</Link>
        </Button>
      </div>
    )
  }

  const deductions = employee.customDeductions ?? []
  const mapping = hubstaff.employeeMapping.find((m) => m.bambooEmployeeId === employee.id)
  const paymentMethod: PaymentMethod = paymentMethods[employee.id] ?? 'transfer'
  const bankAccount = bankAccounts[employee.id] ?? { bank: '', accountNumber: '' }
  // Bank field labels follow the APP interface language (not the employee's country).
  // The Spanish labels appear only on the paystub PDF for DR/Mexico employees.
  const bankLabels = BANK_FIELD_LABELS[uiLang]

  const openAdd = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (d: CustomDeduction) => {
    setEditingId(d.id)
    setForm({ name: d.name, type: d.type, amount: String(d.amount), recurring: d.recurring, active: d.active })
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ variant: 'destructive', title: t('errors.required') })
      return
    }
    const amount = parseFloat(form.amount)
    if (isNaN(amount) || amount < 0) {
      toast({ variant: 'destructive', title: t('errors.invalidNumber') })
      return
    }
    if (editingId) {
      updateDeduction(employee.id, editingId, {
        name: form.name.trim(),
        type: form.type,
        amount,
        recurring: form.recurring,
        active: form.active,
      })
    } else {
      addDeduction(employee.id, {
        name: form.name.trim(),
        type: form.type,
        amount,
        recurring: form.recurring,
        active: form.active,
      })
    }
    toast({ variant: 'success', title: t('common.success') })
    setDialogOpen(false)
  }

  const handleDelete = (deductionId: string) => {
    removeDeduction(employee.id, deductionId)
    toast({ title: t('common.success') })
  }

  const statusVariant = employee.status === 'Active' ? 'default' : employee.status === 'Inactive' ? 'secondary' : 'destructive'

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/nomina/employees">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t('common.back')}
          </Link>
        </Button>
      </div>

      {/* Employee header card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-xl font-bold text-emerald-700">
              {getInitials(employee.firstName, employee.lastName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground">
                  {employee.firstName} {employee.lastName}
                </h1>
                <Badge variant={statusVariant}>
                  {t(`employees.status.${employee.status.toLowerCase()}`)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{employee.jobTitle} {employee.department ? `· ${employee.department}` : ''}</p>
              <p className="text-sm text-muted-foreground">{employee.workEmail}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payroll info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('employees.profile.payrollInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{t('employees.profile.payRate')}</dt>
              <dd className="mt-0.5 text-sm font-semibold text-foreground">
                {formatCurrency(employee.payRate)}/hr
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t('employees.profile.hireDate')}</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {formatDate(employee.hireDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{t('employees.profile.department')}</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {employee.department || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Employee ID</dt>
              <dd className="mt-0.5 text-sm font-mono text-muted-foreground">{employee.id}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-1">{t('employees.profile.paymentMethod')}</dt>
              <dd>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(employee.id, v as PaymentMethod)}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transfer">{PAYMENT_METHOD_LABELS[uiLang].transfer}</SelectItem>
                    <SelectItem value="cash">{PAYMENT_METHOD_LABELS[uiLang].cash}</SelectItem>
                    <SelectItem value="check">{PAYMENT_METHOD_LABELS[uiLang].check}</SelectItem>
                  </SelectContent>
                </Select>
              </dd>
            </div>
          </dl>

          {/* Bank account — only for Transfer payment method */}
          {paymentMethod === 'transfer' && (
            <div className="mt-4 border-t border-border pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{bankLabels.bank}</Label>
                  <Select
                    value={bankAccount.bank}
                    onValueChange={(v) => setBankAccount(employee.id, { bank: v })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={bankLabels.bank} />
                    </SelectTrigger>
                    <SelectContent>
                      {RD_BANKS.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{bankLabels.accountNumber}</Label>
                  <Input
                    value={bankAccount.accountNumber}
                    onChange={(e) => setBankAccount(employee.id, { accountNumber: e.target.value })}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{bankLabels.note}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hubstaff mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('employees.profile.hubstaffMapping')}</CardTitle>
        </CardHeader>
        <CardContent>
          {mapping ? (
            <div className="flex items-center gap-2">
              <Badge variant="default">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {t('employees.profile.mappedBadge')}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Hubstaff user ID: <code className="font-mono">{mapping.hubstaffUserId}</code>
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t('employees.profile.notMapped')}{' '}
              <Link to="/nomina/connectors" className="text-emerald-600 hover:underline">
                {t('employees.profile.configureConnectors')}
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Custom deductions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('employees.profile.deductions')}</CardTitle>
            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1 h-4 w-4" />
              {t('employees.deductions.addDeduction')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {deductions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">{t('employees.deductions.noDeductions')}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={openAdd}>
                <Plus className="mr-1 h-4 w-4" />
                {t('employees.deductions.addDeduction')}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('employees.deductions.name')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('employees.deductions.type')}</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('employees.deductions.amount')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('employees.deductions.recurring')}</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {deductions.map((d) => (
                    <tr key={d.id} className={`hover:bg-secondary transition-colors ${!d.active ? 'opacity-50' : ''}`}>
                      <td className="px-6 py-3 font-medium text-foreground">{d.name}</td>
                      <td className="px-6 py-3">
                        <Badge variant="secondary">
                          {d.type === 'fixed' ? t('employees.deductions.fixedAmount') : t('employees.deductions.percentage')}
                        </Badge>
                      </td>
                      <td className="px-6 py-3 text-right font-medium text-foreground">
                        {d.type === 'fixed' ? formatCurrency(d.amount) : `${d.amount}%`}
                      </td>
                      <td className="px-6 py-3">
                        <Badge variant={d.recurring ? 'default' : 'secondary'}>
                          {d.recurring ? t('employees.deductions.recurring') : t('employees.deductions.oneTime')}
                        </Badge>
                      </td>
                      <td className="px-6 py-3">
                        <Switch
                          checked={d.active}
                          onCheckedChange={(v) => updateDeduction(employee.id, d.id, { active: v })}
                        />
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(d.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vacation info (BambooHR) */}
      <VacationInfoSection employee={employee} />

      {/* Deduction dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('common.edit') : t('employees.deductions.addDeduction')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('employees.deductions.addDeduction')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('employees.deductions.name')}</Label>
              <Input
                placeholder="e.g. Loan, Uniform, Cooperative"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('employees.deductions.type')}</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm((f) => ({ ...f, type: v as 'fixed' | 'percentage' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">{t('employees.deductions.fixedAmount')}</SelectItem>
                    <SelectItem value="percentage">{t('employees.deductions.percentage')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>
                  {t('employees.deductions.amount')}
                  {form.type === 'percentage' ? ' (%)' : ' (RD$)'}
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">{t('employees.deductions.recurring')}</p>
                <p className="text-xs text-muted-foreground">{t('employees.deductions.oneTime')}</p>
              </div>
              <Switch
                checked={form.recurring}
                onCheckedChange={(v) => setForm((f) => ({ ...f, recurring: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

