import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, TrendingUp, FileText, Clock } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { formatCurrency } from '@/shared/lib/utils/currency'
import { useBillingStore } from '@/modules/facturacion/store/billingStore'
import { useBillingAccess } from '@/modules/facturacion/lib/permissions'
import { BillingPageHeader } from '@/modules/facturacion/components/BillingPageHeader'
import { EmptyStateCard, RestrictedCard } from '@/modules/facturacion/components/BillingStates'
import {
  revenueByClient, revenueByMonth, revenueByLineType, billedHoursByEmployee, billingTotals, toCsv,
} from '@/modules/facturacion/lib/reports'

export default function Reports() {
  const { t } = useTranslation()
  const { canViewFinancials } = useBillingAccess()
  const invoices = useBillingStore((s) => s.invoices)
  const clients = useBillingStore((s) => s.clients)

  const nameFor = (id: string) => clients.find((c) => c.id === id)?.name ?? id
  // Reports assume a single currency across the workspace; use the first client's currency for display.
  const displayCountry = clients[0]?.currencyCountry ?? 'Dominican Republic'

  const byClient = useMemo(() => revenueByClient(invoices, nameFor), [invoices, clients])
  const byMonth = useMemo(() => revenueByMonth(invoices), [invoices])
  const byType = useMemo(() => revenueByLineType(invoices), [invoices])
  const byHours = useMemo(() => billedHoursByEmployee(invoices), [invoices])
  const totals = useMemo(() => billingTotals(invoices), [invoices])

  if (!canViewFinancials) {
    return (
      <div className="space-y-6">
        <BillingPageHeader title={t('facturacion.reports.title')} subtitle={t('facturacion.reports.subtitle')} />
        <RestrictedCard title={t('facturacion.restricted.financialsTitle')} hint={t('facturacion.restricted.reportsHint')} />
      </div>
    )
  }

  if (invoices.length === 0) {
    return (
      <div className="space-y-6">
        <BillingPageHeader title={t('facturacion.reports.title')} subtitle={t('facturacion.reports.subtitle')} />
        <EmptyStateCard title={t('facturacion.reports.empty')} hint={t('facturacion.reports.emptyHint')} />
      </div>
    )
  }

  const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csv = toCsv(headers, rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const monthChart = byMonth.map((m) => ({ name: m.month, total: m.total }))

  return (
    <div className="space-y-6">
      <BillingPageHeader title={t('facturacion.reports.title')} subtitle={t('facturacion.reports.subtitle')} />

      {/* KPI tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon={<TrendingUp className="h-5 w-5" />} label={t('facturacion.reports.finalizedRevenue')} value={formatCurrency(totals.finalizedTotal, displayCountry)} />
        <KpiTile icon={<FileText className="h-5 w-5" />} label={t('facturacion.reports.draftPipeline')} value={formatCurrency(totals.draftTotal, displayCountry)} />
        <KpiTile icon={<FileText className="h-5 w-5" />} label={t('facturacion.reports.finalizedCount')} value={String(totals.finalizedCount)} />
        <KpiTile icon={<Clock className="h-5 w-5" />} label={t('facturacion.reports.draftCount')} value={String(totals.draftCount)} />
      </div>

      {/* Revenue by month */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('facturacion.reports.revenueByMonth')}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCsv('revenue_by_month.csv', [t('common.period'), t('common.total'), t('facturacion.invoices.number')], byMonth.map((m) => [m.month, m.total, m.invoiceCount]))}>
            <Download className="mr-2 h-4 w-4" />{t('common.export')}
          </Button>
        </CardHeader>
        <CardContent>
          {monthChart.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('facturacion.reports.noFinalized')}</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" fontSize={12} stroke="currentColor" className="text-muted-foreground" />
                  <YAxis fontSize={12} stroke="currentColor" className="text-muted-foreground" />
                  <Tooltip formatter={(v: number) => formatCurrency(v, displayCountry)} />
                  <Bar dataKey="total" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revenue by client */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('facturacion.reports.revenueByClient')}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCsv('revenue_by_client.csv',
            [t('common.name'), t('facturacion.reports.finalizedRevenue'), t('facturacion.reports.draftPipeline'), t('facturacion.invoices.number')],
            byClient.map((r) => [r.clientName, r.finalizedTotal, r.draftTotal, r.invoiceCount]))}>
            <Download className="mr-2 h-4 w-4" />{t('common.export')}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ReportTable
            headers={[t('common.name'), t('facturacion.reports.finalizedRevenue'), t('facturacion.reports.draftPipeline'), t('facturacion.invoices.number')]}
            rows={byClient.map((r) => [r.clientName, formatCurrency(r.finalizedTotal, displayCountry), formatCurrency(r.draftTotal, displayCountry), String(r.invoiceCount)])}
            numericFrom={1}
          />
        </CardContent>
      </Card>

      {/* Revenue by line type */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('facturacion.reports.revenueByType')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ReportTable
            headers={[t('facturacion.lines.description'), t('common.total')]}
            rows={byType.map((r) => [t(`facturacion.lineType.${r.type}`), formatCurrency(r.total, displayCountry)])}
            numericFrom={1}
          />
        </CardContent>
      </Card>

      {/* Billed hours by employee */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('facturacion.reports.billedHours')}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => downloadCsv('billed_hours.csv',
            [t('common.name'), t('facturacion.lines.basePay'), t('facturacion.lines.overtime'), t('common.total')],
            byHours.map((r) => [r.employeeName, r.baseHours, r.overtimeHours, r.total]))}>
            <Download className="mr-2 h-4 w-4" />{t('common.export')}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {byHours.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('facturacion.reports.noHours')}</p>
          ) : (
            <ReportTable
              headers={[t('common.name'), `${t('facturacion.lines.basePay')} (${t('common.hours')})`, `${t('facturacion.lines.overtime')} (${t('common.hours')})`, t('common.total')]}
              rows={byHours.map((r) => [r.employeeName, String(r.baseHours), String(r.overtimeHours), formatCurrency(r.total, displayCountry)])}
              numericFrom={1}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-bold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function ReportTable({ headers, rows, numericFrom = 999 }: { headers: string[]; rows: string[][]; numericFrom?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
          <tr>{headers.map((h, i) => <th key={i} className={`px-4 py-3 font-medium ${i >= numericFrom ? 'text-right' : 'text-left'}`}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-border">
              {r.map((c, ci) => <td key={ci} className={`px-4 py-3 ${ci >= numericFrom ? 'text-right font-medium text-foreground' : 'text-foreground'}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
