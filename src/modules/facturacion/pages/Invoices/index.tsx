import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus, Search, FileText } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { normalize, formatDateRange, formatDate } from '@/shared/lib/utils'
import { formatCurrency } from '@/shared/lib/utils/currency'
import { useBillingStore } from '@/modules/facturacion/store/billingStore'
import { useBillingAccess } from '@/modules/facturacion/lib/permissions'
import { BillingPageHeader } from '@/modules/facturacion/components/BillingPageHeader'
import { EmptyStateCard } from '@/modules/facturacion/components/BillingStates'

export default function Invoices() {
  const { t } = useTranslation()
  const { canEdit } = useBillingAccess()
  const invoices = useBillingStore((s) => s.invoices)
  const clients = useBillingStore((s) => s.clients)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')

  const clientName = (cid: string) => clients.find((c) => c.id === cid)?.name ?? '—'

  const filtered = useMemo(() => {
    const q = normalize(search)
    return invoices
      .filter((inv) => statusFilter === 'all' || inv.status === statusFilter)
      .filter((inv) => clientFilter === 'all' || inv.clientId === clientFilter)
      .filter((inv) => !q || normalize(inv.number).includes(q) || normalize(clientName(inv.clientId)).includes(q))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, search, statusFilter, clientFilter, clients])

  return (
    <div className="space-y-6">
      <BillingPageHeader
        title={t('facturacion.invoices.title')}
        subtitle={t('facturacion.invoices.subtitle')}
        actions={canEdit ? (
          <Button asChild><Link to="/facturacion/invoices/new"><Plus className="mr-2 h-4 w-4" />{t('facturacion.invoices.newInvoice')}</Link></Button>
        ) : undefined}
      />

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('facturacion.invoices.allStatuses')}</SelectItem>
            <SelectItem value="draft">{t('facturacion.invoiceStatus.draft')}</SelectItem>
            <SelectItem value="finalized">{t('facturacion.invoiceStatus.finalized')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('facturacion.invoices.allClients')}</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyStateCard
          title={t('facturacion.invoices.emptyTitle')}
          hint={canEdit ? t('facturacion.invoices.emptyHint') : undefined}
          action={canEdit ? <Button className="mt-2" asChild><Link to="/facturacion/invoices/new"><Plus className="mr-2 h-4 w-4" />{t('facturacion.invoices.newInvoice')}</Link></Button> : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">{t('facturacion.invoices.number')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('facturacion.nav.clients')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('common.period')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('facturacion.pdf.issueDate')}</th>
                    <th className="px-4 py-3 text-right font-medium">{t('common.total')}</th>
                    <th className="px-4 py-3 text-left font-medium">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-t border-border transition-colors hover:bg-secondary/30">
                      <td className="px-4 py-3">
                        <Link to={`/facturacion/invoices/${inv.id}`} className="flex items-center gap-2 font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                          <FileText className="h-4 w-4" />{inv.number || t('facturacion.invoices.draft')}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-foreground">{clientName(inv.clientId)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDateRange(inv.periodStart, inv.periodEnd)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issueDate)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground">{formatCurrency(inv.total, inv.currencyCountry)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={inv.status === 'finalized' ? 'default' : 'secondary'}>{t(`facturacion.invoiceStatus.${inv.status}`)}</Badge>
                      </td>
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
