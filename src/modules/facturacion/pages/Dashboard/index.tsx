import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Building2, FileText, Users, TrendingUp, ArrowRight, Clock, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { formatDateRange, formatDate } from '@/shared/lib/utils'
import { formatCurrency } from '@/shared/lib/utils/currency'
import { getBillablePayrollRuns } from '@/shared/lib/payrollData'
import { useBillingStore } from '@/modules/facturacion/store/billingStore'
import { useBillingAccess } from '@/modules/facturacion/lib/permissions'
import { billingTotals } from '@/modules/facturacion/lib/reports'
import { BillingPageHeader } from '@/modules/facturacion/components/BillingPageHeader'
import { EmptyStateCard } from '@/modules/facturacion/components/BillingStates'

export default function Dashboard() {
  const { t } = useTranslation()
  const { canEdit, canViewFinancials } = useBillingAccess()
  const clients = useBillingStore((s) => s.clients)
  const assignments = useBillingStore((s) => s.clientEmployees)
  const invoices = useBillingStore((s) => s.invoices)

  const runs = useMemo(() => getBillablePayrollRuns(), [])
  const totals = useMemo(() => billingTotals(invoices), [invoices])
  const displayCountry = clients[0]?.currencyCountry ?? 'United States'

  const activeClients = clients.filter((c) => c.active).length
  const activeAssignments = assignments.filter((a) => a.active).length
  const recent = useMemo(
    () => [...invoices].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5),
    [invoices],
  )
  const nameFor = (id: string) => clients.find((c) => c.id === id)?.name ?? id

  const isEmpty = clients.length === 0 && invoices.length === 0

  return (
    <div className="space-y-6">
      <BillingPageHeader
        title={t('facturacion.dashboard.title')}
        subtitle={t('facturacion.dashboard.subtitle')}
        actions={canEdit ? (
          <Button asChild><Link to="/facturacion/invoices/new"><Plus className="mr-2 h-4 w-4" />{t('facturacion.invoices.newInvoice')}</Link></Button>
        ) : undefined}
      />

      {isEmpty ? (
        <EmptyStateCard
          title={t('facturacion.dashboard.emptyTitle')}
          hint={t('facturacion.dashboard.emptyHint')}
          action={canEdit ? <Button className="mt-2" asChild><Link to="/facturacion/clients">{t('facturacion.clients.newClient')}</Link></Button> : undefined}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile icon={<Building2 className="h-5 w-5" />} label={t('facturacion.dashboard.activeClients')} value={String(activeClients)} to="/facturacion/clients" />
            <Tile icon={<Users className="h-5 w-5" />} label={t('facturacion.dashboard.assignedEmployees')} value={String(activeAssignments)} />
            <Tile icon={<Clock className="h-5 w-5" />} label={t('facturacion.dashboard.draftInvoices')} value={String(totals.draftCount)} to="/facturacion/invoices" />
            {canViewFinancials ? (
              <Tile icon={<TrendingUp className="h-5 w-5" />} label={t('facturacion.reports.finalizedRevenue')} value={formatCurrency(totals.finalizedTotal, displayCountry)} to="/facturacion/reports" />
            ) : (
              <Tile icon={<FileText className="h-5 w-5" />} label={t('facturacion.dashboard.finalizedInvoices')} value={String(totals.finalizedCount)} to="/facturacion/invoices" />
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Recent invoices */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{t('facturacion.dashboard.recentInvoices')}</CardTitle>
                <Link to="/facturacion/invoices" className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline dark:text-emerald-400">
                  {t('common.viewDetails')}<ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {recent.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{t('facturacion.invoices.emptyTitle')}</p>
                ) : recent.map((inv) => (
                  <Link key={inv.id} to={`/facturacion/invoices/${inv.id}`} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-secondary/40">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{inv.number || t('facturacion.invoices.draft')}</p>
                      <p className="truncate text-xs text-muted-foreground">{nameFor(inv.clientId)} · {formatDate(inv.issueDate)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-foreground">{formatCurrency(inv.total, inv.currencyCountry)}</span>
                      <Badge variant={inv.status === 'finalized' ? 'default' : 'secondary'}>{t(`facturacion.invoiceStatus.${inv.status}`)}</Badge>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>

            {/* Finalized runs ready to bill */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{t('facturacion.dashboard.runsToBill')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {runs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{t('facturacion.invoices.noRuns')}</p>
                ) : runs.slice(0, 6).map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{formatDateRange(r.startDate, r.endDate)}</p>
                      <p className="truncate text-xs text-muted-foreground">{t(`facturacion.runStatus.${r.status}`)} · {r.employeeCount} {t('common.employees').toLowerCase()}</p>
                    </div>
                    {canEdit && (
                      <Button variant="ghost" size="sm" asChild><Link to="/facturacion/invoices/new">{t('facturacion.dashboard.bill')}</Link></Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function Tile({ icon, label, value, to }: { icon: React.ReactNode; label: string; value: string; to?: string }) {
  const inner = (
    <Card className={to ? 'transition-colors hover:border-emerald-300 dark:hover:border-emerald-700' : ''}>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}
