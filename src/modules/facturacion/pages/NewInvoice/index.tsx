import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { formatDateRange } from '@/shared/lib/utils'
import { formatCurrency } from '@/shared/lib/utils/currency'
import { getBillablePayrollRuns } from '@/shared/lib/payrollData'
import { useEmployeesStore } from '@/shared/store/employeesStore'
import { useEmployeeHrStore } from '@/shared/store/employeeHrStore'
import { useBillingStore } from '@/modules/facturacion/store/billingStore'
import { useBillingAccess } from '@/modules/facturacion/lib/permissions'
import { auditInvoiceGenerated } from '@/modules/facturacion/lib/audit'
import { computeInvoiceLines, sumLineItems, assignmentsByDivision, type RosterEmployee } from '@/modules/facturacion/lib/compute'
import { BillingPageHeader } from '@/modules/facturacion/components/BillingPageHeader'
import { EmptyStateCard, RestrictedCard } from '@/modules/facturacion/components/BillingStates'

export default function NewInvoice() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { canEdit, canViewFinancials } = useBillingAccess()

  const clients = useBillingStore((s) => s.clients)
  const titleRates = useBillingStore((s) => s.titleRates)
  const assignments = useBillingStore((s) => s.clientEmployees)
  const createInvoice = useBillingStore((s) => s.createInvoice)
  const ensureClientsForDivisions = useBillingStore((s) => s.ensureClientsForDivisions)
  const employees = useEmployeesStore((s) => s.employees)
  const hrById = useEmployeeHrStore((s) => s.byId)

  const [clientId, setClientId] = useState(params.get('client') ?? '')
  const [selectedRuns, setSelectedRuns] = useState<Set<string>>(new Set())

  const runs = useMemo(() => getBillablePayrollRuns(), [])
  const client = clients.find((c) => c.id === clientId)
  // Roster carries each employee's division (= client) from the shared HR store.
  const roster: RosterEmployee[] = useMemo(
    () => employees.map((e) => ({
      id: e.id, firstName: e.firstName, lastName: e.lastName, jobTitle: e.jobTitle,
      division: hrById[e.id]?.division ?? '',
    })),
    [employees, hrById],
  )

  // Auto-create a billing client for every BambooHR division (client) present in the roster.
  useEffect(() => {
    const divisions = [...new Set(roster.map((e) => (e.division ?? '').trim()).filter(Boolean))]
    if (divisions.length) ensureClientsForDivisions(divisions)
  }, [roster, ensureClientsForDivisions])

  const labels = {
    basePay: t('facturacion.lines.basePay'),
    overtime: t('facturacion.lines.overtime'),
    fixed: t('facturacion.lines.fixed'),
    percentage: t('facturacion.lines.percentage'),
  }

  // Auto-grouped: every employee whose division matches the client (manual overrides kept).
  const clientAssignments = useMemo(
    () => (client ? assignmentsByDivision(client, roster, assignments).filter((a) => a.active) : []),
    [client, roster, assignments],
  )

  // Does this client use the percentage method anywhere? Then financial access is required.
  const usesPercentage = useMemo(() => {
    if (!client) return false
    if (client.defaultMethod === 'percentage') {
      if (clientAssignments.some((a) => a.method == null || a.method === 'percentage')) return true
    }
    return clientAssignments.some((a) => a.method === 'percentage')
  }, [client, clientAssignments])

  const preview = useMemo(() => {
    if (!client || selectedRuns.size === 0) return null
    return computeInvoiceLines(
      { client, assignments: clientAssignments, titleRates, roster, payrollRunIds: [...selectedRuns] },
      labels,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, clientAssignments, titleRates, roster, selectedRuns])

  const period = useMemo(() => {
    const sel = runs.filter((r) => selectedRuns.has(r.id))
    if (sel.length === 0) return null
    return {
      start: sel.reduce((min, r) => (r.startDate < min ? r.startDate : min), sel[0].startDate),
      end: sel.reduce((max, r) => (r.endDate > max ? r.endDate : max), sel[0].endDate),
    }
  }, [runs, selectedRuns])

  if (!canEdit) {
    return <RestrictedCard title={t('facturacion.restricted.editTitle')} hint={t('facturacion.restricted.editHint')} />
  }

  const toggleRun = (id: string) => {
    setSelectedRuns((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const blockedByFinancials = usesPercentage && !canViewFinancials

  const handleCreate = () => {
    if (!client || !preview || !period) return
    const invoice = createInvoice({
      clientId: client.id,
      number: '',
      status: 'draft',
      periodStart: period.start,
      periodEnd: period.end,
      payrollRunIds: preview.usedRunIds.length ? preview.usedRunIds : [...selectedRuns],
      lineItems: preview.lineItems,
      subtotal: sumLineItems(preview.lineItems),
      total: sumLineItems(preview.lineItems),
      currencyCountry: client.currencyCountry,
      notes: '',
      issueDate: new Date().toISOString().slice(0, 10),
      finalizedAt: null,
      createdBy: null,
      clientNameSnapshot: client.name,
    })
    auditInvoiceGenerated(invoice.id, client.id, invoice.total)
    navigate(`/facturacion/invoices/${invoice.id}`)
  }

  return (
    <div className="space-y-6">
      <Link to="/facturacion/invoices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400">
        <ArrowLeft className="h-4 w-4" /> {t('facturacion.invoices.title')}
      </Link>
      <BillingPageHeader title={t('facturacion.invoices.newInvoice')} subtitle={t('facturacion.invoices.newSubtitle')} />

      <Card>
        <CardHeader><CardTitle className="text-base">{t('facturacion.invoices.step1')}</CardTitle></CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <Select value={clientId} onValueChange={(v) => { setClientId(v); setSelectedRuns(new Set()) }}>
              <SelectTrigger><SelectValue placeholder={t('facturacion.invoices.selectClient')} /></SelectTrigger>
              <SelectContent>
                {clients.filter((c) => c.active).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {client && clientAssignments.length === 0 && (
            <p className="mt-3 flex items-center gap-2 text-sm text-amber-600"><AlertTriangle className="h-4 w-4" />{t('facturacion.invoices.noAssignments')}</p>
          )}
        </CardContent>
      </Card>

      {client && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t('facturacion.invoices.step2')}</CardTitle></CardHeader>
          <CardContent>
            {runs.length === 0 ? (
              <EmptyStateCard title={t('facturacion.invoices.noRuns')} hint={t('facturacion.invoices.noRunsHint')} />
            ) : (
              <div className="space-y-2">
                {runs.map((r) => (
                  <label key={r.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-secondary/40">
                    <Checkbox checked={selectedRuns.has(r.id)} onCheckedChange={() => toggleRun(r.id)} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{formatDateRange(r.startDate, r.endDate)}</p>
                      <p className="text-xs text-muted-foreground">
                        {t(`facturacion.runStatus.${r.status}`)} · {r.employeeCount} {t('common.employees').toLowerCase()}{r.country ? ` · ${r.country}` : ''}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {client && preview && period && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t('facturacion.invoices.preview')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {blockedByFinancials ? (
              <RestrictedCard title={t('facturacion.restricted.financialsTitle')} hint={t('facturacion.restricted.financialsHint')} />
            ) : (
              <>
                {preview.lineItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('facturacion.invoices.noLines')}</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">{t('facturacion.lines.employee')}</th>
                          <th className="px-3 py-2 text-left font-medium">{t('facturacion.lines.description')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('facturacion.lines.qty')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('facturacion.lines.rate')}</th>
                          <th className="px-3 py-2 text-right font-medium">{t('common.amount')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.lineItems.map((l) => (
                          <tr key={l.id} className="border-t border-border">
                            <td className="px-3 py-2"><span className="font-medium text-foreground">{l.employeeName}</span></td>
                            <td className="px-3 py-2 text-muted-foreground">{l.label}</td>
                            <td className="px-3 py-2 text-right">{l.type === 'base' || l.type === 'overtime' ? l.quantity : '—'}</td>
                            <td className="px-3 py-2 text-right">{l.type === 'percentage' ? '—' : formatCurrency(l.rate, client.currencyCountry)}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatCurrency(l.amount, client.currencyCountry)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {preview.employeesWithoutRate.length > 0 && (
                  <p className="flex items-start gap-2 text-xs text-amber-600"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{t('facturacion.invoices.missingRates', { names: preview.employeesWithoutRate.join(', ') })}</p>
                )}
                {preview.employeesWithoutHours.length > 0 && (
                  <p className="text-xs text-muted-foreground">{t('facturacion.invoices.noHoursFor', { names: preview.employeesWithoutHours.join(', ') })}</p>
                )}
                <div className="flex items-center justify-between border-t border-border pt-3">
                  <div className="text-sm text-muted-foreground">{formatDateRange(period.start, period.end)}</div>
                  <div className="text-lg font-bold text-emerald-600">{formatCurrency(sumLineItems(preview.lineItems), client.currencyCountry)}</div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleCreate} disabled={preview.lineItems.length === 0}>
                    <FileText className="mr-2 h-4 w-4" />{t('facturacion.invoices.createDraft')}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
