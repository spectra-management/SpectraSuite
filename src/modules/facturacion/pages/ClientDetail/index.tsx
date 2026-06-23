import { useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Pencil, Trash2, Plus, UserPlus, X, SlidersHorizontal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { formatCurrency } from '@/shared/lib/utils/currency'
import { useEmployeesStore } from '@/shared/store/employeesStore'
import { useBillingStore } from '@/modules/facturacion/store/billingStore'
import { useBillingAccess } from '@/modules/facturacion/lib/permissions'
import { auditClientUpdated, auditRateChanged } from '@/modules/facturacion/lib/audit'
import { findTitleRate, resolveRate } from '@/modules/facturacion/lib/rates'
import { BillingPageHeader } from '@/modules/facturacion/components/BillingPageHeader'
import { EmptyStateCard } from '@/modules/facturacion/components/BillingStates'
import { ClientFormDialog, type ClientFormValues } from '@/modules/facturacion/components/ClientFormDialog'
import { AssignmentOverrideDialog, type OverrideValues } from '@/modules/facturacion/components/AssignmentOverrideDialog'
import type { ClientEmployee } from '@/modules/facturacion/lib/types'

export default function ClientDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { canEdit } = useBillingAccess()

  const client = useBillingStore((s) => s.clients.find((c) => c.id === id))
  const titleRates = useBillingStore((s) => s.titleRates)
  const assignments = useBillingStore((s) => s.clientEmployees)
  const updateClient = useBillingStore((s) => s.updateClient)
  const removeClient = useBillingStore((s) => s.removeClient)
  const upsertTitleRate = useBillingStore((s) => s.upsertTitleRate)
  const removeTitleRate = useBillingStore((s) => s.removeTitleRate)
  const assignEmployee = useBillingStore((s) => s.assignEmployee)
  const updateAssignment = useBillingStore((s) => s.updateAssignment)
  const removeAssignment = useBillingStore((s) => s.removeAssignment)

  const employees = useEmployeesStore((s) => s.employees)

  const [editOpen, setEditOpen] = useState(false)
  const [overrideFor, setOverrideFor] = useState<ClientEmployee | null>(null)
  const [pickEmployee, setPickEmployee] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newBase, setNewBase] = useState('')
  const [newOt, setNewOt] = useState('')

  const clientTitleRates = useMemo(() => titleRates.filter((r) => r.clientId === id), [titleRates, id])
  const clientAssignments = useMemo(
    () => assignments.filter((a) => a.clientId === id && a.active),
    [assignments, id],
  )
  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])

  const unassigned = useMemo(() => {
    const taken = new Set(clientAssignments.map((a) => a.employeeId))
    return employees
      .filter((e) => e.payroll_active && !taken.has(e.id))
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
  }, [employees, clientAssignments])

  // Unique job titles across assigned employees (suggestions for title rates).
  const assignedTitles = useMemo(() => {
    const titles = new Set<string>()
    clientAssignments.forEach((a) => {
      const e = empById.get(a.employeeId)
      if (e?.jobTitle) titles.add(e.jobTitle)
    })
    return [...titles].sort()
  }, [clientAssignments, empById])

  if (!client) {
    return (
      <div className="space-y-6">
        <EmptyStateCard title={t('facturacion.clients.notFound')} action={
          <Button variant="outline" className="mt-2" asChild><Link to="/facturacion/clients">{t('common.back')}</Link></Button>
        } />
      </div>
    )
  }

  const handleEdit = (values: ClientFormValues) => {
    updateClient(client.id, values)
    auditClientUpdated(client.id, values.name)
  }

  const handleDelete = () => {
    if (!window.confirm(t('facturacion.clients.deleteConfirm', { name: client.name }))) return
    removeClient(client.id)
    navigate('/facturacion/clients')
  }

  const handleAddTitleRate = () => {
    const title = newTitle.trim()
    if (!title) return
    const base = Number(newBase) || 0
    const ot = Number(newOt) || 0
    const row = upsertTitleRate(client.id, title, base, ot)
    auditRateChanged(client.id, 'title', row.id, { title, baseRate: base, otRate: ot })
    setNewTitle(''); setNewBase(''); setNewOt('')
  }

  const handleAssign = () => {
    if (!pickEmployee) return
    assignEmployee(client.id, pickEmployee)
    auditRateChanged(client.id, 'employee', pickEmployee, { action: 'assigned' })
    setPickEmployee('')
  }

  const handleSaveOverride = (a: ClientEmployee, values: OverrideValues) => {
    updateAssignment(a.id, values)
    auditRateChanged(client.id, 'employee', a.employeeId, { ...values })
  }

  return (
    <div className="space-y-6">
      <Link to="/facturacion/clients" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400">
        <ArrowLeft className="h-4 w-4" /> {t('facturacion.clients.title')}
      </Link>

      <BillingPageHeader
        title={client.name}
        subtitle={[client.contactName, client.contactEmail].filter(Boolean).join(' · ') || undefined}
        actions={canEdit ? (
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />{t('common.edit')}</Button>
            <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={handleDelete}><Trash2 className="h-4 w-4" /></Button>
          </>
        ) : undefined}
      />

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label={t('facturacion.clients.invoicePrefix')} value={client.invoicePrefix} />
        <SummaryCard label={t('facturacion.clients.defaultMethod')} value={t(`facturacion.method.${client.defaultMethod}`)} />
        <SummaryCard label={t('facturacion.clients.currency')} value={client.currencyCountry} />
        <SummaryCard label={t('facturacion.clients.assigned')} value={String(clientAssignments.length)} />
      </div>

      {/* Title rates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('facturacion.titleRates.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('facturacion.titleRates.desc')}</p>
          {clientTitleRates.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t('facturacion.titleRates.jobTitle')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('facturacion.titleRates.baseRate')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('facturacion.titleRates.otRate')}</th>
                    {canEdit && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {clientTitleRates.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2 font-medium text-foreground">{r.title}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(r.baseRate, client.currencyCountry)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(r.otRate, client.currencyCountry)}</td>
                      {canEdit && (
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => { removeTitleRate(r.id); auditRateChanged(client.id, 'title', r.id, { action: 'removed' }) }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canEdit && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
              <div className="min-w-[180px] flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">{t('facturacion.titleRates.jobTitle')}</label>
                <Input list="title-suggestions" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder={t('facturacion.titleRates.jobTitlePlaceholder')} />
                <datalist id="title-suggestions">
                  {assignedTitles.map((tt) => <option key={tt} value={tt} />)}
                </datalist>
              </div>
              <div className="w-28">
                <label className="mb-1 block text-xs text-muted-foreground">{t('facturacion.titleRates.baseRate')}</label>
                <Input inputMode="decimal" value={newBase} onChange={(e) => setNewBase(e.target.value)} placeholder="0.00" />
              </div>
              <div className="w-28">
                <label className="mb-1 block text-xs text-muted-foreground">{t('facturacion.titleRates.otRate')}</label>
                <Input inputMode="decimal" value={newOt} onChange={(e) => setNewOt(e.target.value)} placeholder="0.00" />
              </div>
              <Button onClick={handleAddTitleRate} disabled={!newTitle.trim()}><Plus className="mr-2 h-4 w-4" />{t('common.add')}</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assigned employees */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('facturacion.assign.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {canEdit && (
            <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
              <div className="min-w-[220px] flex-1">
                <label className="mb-1 block text-xs text-muted-foreground">{t('facturacion.assign.addEmployee')}</label>
                <Select value={pickEmployee} onValueChange={setPickEmployee}>
                  <SelectTrigger><SelectValue placeholder={t('facturacion.assign.selectEmployee')} /></SelectTrigger>
                  <SelectContent>
                    {unassigned.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">{t('facturacion.assign.allAssigned')}</div>
                    ) : unassigned.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName}{e.jobTitle ? ` — ${e.jobTitle}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAssign} disabled={!pickEmployee}><UserPlus className="mr-2 h-4 w-4" />{t('facturacion.assign.assign')}</Button>
            </div>
          )}

          {clientAssignments.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('facturacion.assign.empty')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t('common.name')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('facturacion.assign.jobTitle')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('facturacion.assign.method')}</th>
                    <th className="px-3 py-2 text-left font-medium">{t('facturacion.assign.effectiveRate')}</th>
                    {canEdit && <th className="px-3 py-2" />}
                  </tr>
                </thead>
                <tbody>
                  {clientAssignments.map((a) => {
                    const e = empById.get(a.employeeId)
                    const name = e ? `${e.firstName} ${e.lastName}` : a.employeeId
                    const title = e?.jobTitle ?? ''
                    const tr = findTitleRate(clientTitleRates, client.id, title)
                    const rate = resolveRate(client, a, tr)
                    const hasOverride = a.method != null || a.baseRateOverride != null || a.otRateOverride != null || a.fixedAmount != null || a.percentageRate != null
                    return (
                      <tr key={a.id} className="border-t border-border">
                        <td className="px-3 py-2 font-medium text-foreground">{name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{title || '—'}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">{t(`facturacion.method.${rate.method}`)}</Badge>
                          {hasOverride && <Badge variant="info" className="ml-1">{t('facturacion.assign.override')}</Badge>}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{describeRate(rate, client.currencyCountry, t)}</td>
                        {canEdit && (
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => setOverrideFor(a)}><SlidersHorizontal className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => removeAssignment(a.id)}><X className="h-4 w-4" /></Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button asChild>
          <Link to={`/facturacion/invoices/new?client=${client.id}`}>{t('facturacion.invoices.generateForClient')}</Link>
        </Button>
      </div>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} initial={client} onSubmit={handleEdit} />
      {overrideFor && (
        <AssignmentOverrideDialog
          open={!!overrideFor}
          onOpenChange={(v) => !v && setOverrideFor(null)}
          client={client}
          assignment={overrideFor}
          employeeName={(() => { const e = empById.get(overrideFor.employeeId); return e ? `${e.firstName} ${e.lastName}` : overrideFor.employeeId })()}
          jobTitle={empById.get(overrideFor.employeeId)?.jobTitle ?? ''}
          titleRates={clientTitleRates}
          onSave={(values) => handleSaveOverride(overrideFor, values)}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-lg font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

function describeRate(
  rate: ReturnType<typeof resolveRate>,
  country: string,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  if (rate.method === 'fixed') return formatCurrency(rate.fixedAmount, country)
  if (rate.method === 'percentage') return `${rate.percentageRate}%`
  if (!rate.hasBaseRate) return t('facturacion.assign.noRateSet')
  return `${formatCurrency(rate.baseRate, country)} / ${formatCurrency(rate.otRate, country)} OT`
}
