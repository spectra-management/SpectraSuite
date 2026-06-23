import { useMemo, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, X, Download, Lock, Trash2, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { toast } from '@/shared/hooks/useToast'
import { formatDateRange } from '@/shared/lib/utils'
import { formatCurrency } from '@/shared/lib/utils/currency'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useBillingStore } from '@/modules/facturacion/store/billingStore'
import { useBillingAccess } from '@/modules/facturacion/lib/permissions'
import { auditBonusAdded, auditInvoiceFinalized } from '@/modules/facturacion/lib/audit'
import { makeBonusLine } from '@/modules/facturacion/lib/compute'
import { generateInvoicePdfBlob, downloadBlob } from '@/modules/facturacion/lib/pdf'
import type { InvoicePdfLabels } from '@/modules/facturacion/lib/invoicePdf'
import { BillingPageHeader } from '@/modules/facturacion/components/BillingPageHeader'
import { EmptyStateCard } from '@/modules/facturacion/components/BillingStates'
import { BonusLineDialog, type BonusInput } from '@/modules/facturacion/components/BonusLineDialog'
import type { InvoiceLineItem } from '@/modules/facturacion/lib/types'

export default function InvoiceDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { canEdit } = useBillingAccess()
  const company = useSettingsStore((s) => s.company)

  const invoice = useBillingStore((s) => s.invoices.find((inv) => inv.id === id))
  const client = useBillingStore((s) => s.clients.find((c) => c.id === invoice?.clientId))
  const setInvoiceLines = useBillingStore((s) => s.setInvoiceLines)
  const updateInvoice = useBillingStore((s) => s.updateInvoice)
  const finalizeInvoice = useBillingStore((s) => s.finalizeInvoice)
  const removeInvoice = useBillingStore((s) => s.removeInvoice)
  const rememberBonusLabel = useBillingStore((s) => s.rememberBonusLabel)
  const bonusSuggestions = useBillingStore((s) => s.meta.bonusLabels)

  const [bonusOpen, setBonusOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const finalized = invoice?.status === 'finalized'
  const editable = canEdit && !finalized

  const employeesInInvoice = useMemo(() => {
    if (!invoice) return []
    const map = new Map<string, { id: string; name: string; title: string }>()
    invoice.lineItems.forEach((l) => { if (!map.has(l.employeeId)) map.set(l.employeeId, { id: l.employeeId, name: l.employeeName, title: l.title }) })
    return [...map.values()]
  }, [invoice])

  if (!invoice || !client) {
    return <EmptyStateCard title={t('facturacion.invoices.notFound')} action={
      <Button variant="outline" className="mt-2" asChild><Link to="/facturacion/invoices">{t('common.back')}</Link></Button>
    } />
  }

  const grouped = groupByEmployee(invoice.lineItems)

  const handleAddBonus = (input: BonusInput) => {
    const line = makeBonusLine(input)
    setInvoiceLines(invoice.id, [...invoice.lineItems, line])
    rememberBonusLabel(input.label)
    auditBonusAdded(invoice.id, input.label, line.amount)
  }

  const handleRemoveLine = (lineId: string) => {
    setInvoiceLines(invoice.id, invoice.lineItems.filter((l) => l.id !== lineId))
  }

  const handleFinalize = () => {
    if (!window.confirm(t('facturacion.invoices.finalizeConfirm'))) return
    const fin = finalizeInvoice(invoice.id)
    if (fin) {
      auditInvoiceFinalized(fin.id, fin.number, fin.total)
      toast({ title: t('facturacion.invoices.finalized', { number: fin.number }) })
    }
  }

  const handleDelete = () => {
    if (!window.confirm(t('facturacion.invoices.deleteConfirm'))) return
    removeInvoice(invoice.id)
    navigate('/facturacion/invoices')
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const labels: InvoicePdfLabels = {
        invoice: t('facturacion.pdf.invoice'), number: t('facturacion.pdf.number'), issueDate: t('facturacion.pdf.issueDate'),
        period: t('facturacion.pdf.period'), billTo: t('facturacion.pdf.billTo'), remitTo: t('facturacion.pdf.remitTo'),
        employee: t('facturacion.lines.employee'), description: t('facturacion.lines.description'), qty: t('facturacion.lines.qty'),
        rate: t('facturacion.lines.rate'), amount: t('common.amount'), subtotal: t('facturacion.pdf.subtotal'),
        total: t('common.total'), notes: t('facturacion.clients.notes'), draftWatermark: t('facturacion.invoices.draft'),
        generated: t('facturacion.pdf.generatedBy'),
      }
      // Lazy-load the document (and react-pdf) only when a PDF is actually requested.
      const { InvoiceDocument } = await import('@/modules/facturacion/lib/invoicePdf')
      const el = <InvoiceDocument invoice={invoice} client={client} company={company} labels={labels} />
      const blob = await generateInvoicePdfBlob(el)
      const fname = `${invoice.number || 'DRAFT'}_${client.name.replace(/\s+/g, '_')}.pdf`
      downloadBlob(blob, fname)
    } catch (err) {
      console.error('[billing] invoice PDF failed:', err)
      toast({ variant: 'destructive', title: t('facturacion.invoices.pdfFailed') })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/facturacion/invoices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400">
        <ArrowLeft className="h-4 w-4" /> {t('facturacion.invoices.title')}
      </Link>

      <BillingPageHeader
        title={invoice.number || t('facturacion.invoices.draft')}
        subtitle={`${client.name} · ${formatDateRange(invoice.periodStart, invoice.periodEnd)}`}
        actions={
          <>
            <Badge variant={finalized ? 'default' : 'secondary'}>{t(`facturacion.invoiceStatus.${invoice.status}`)}</Badge>
            <Button variant="outline" onClick={handleDownload} disabled={downloading}>
              <Download className="mr-2 h-4 w-4" />{downloading ? t('common.loading') : t('common.downloadPdf')}
            </Button>
            {editable && (
              <>
                <Button variant="outline" onClick={() => setBonusOpen(true)}><Plus className="mr-2 h-4 w-4" />{t('facturacion.bonus.add')}</Button>
                <Button onClick={handleFinalize}><Lock className="mr-2 h-4 w-4" />{t('facturacion.invoices.finalize')}</Button>
                <Button variant="outline" className="text-red-600 hover:text-red-700" onClick={handleDelete}><Trash2 className="h-4 w-4" /></Button>
              </>
            )}
          </>
        }
      />

      <Card>
        <CardHeader><CardTitle className="text-base">{t('facturacion.invoices.lineItems')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {invoice.lineItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('facturacion.invoices.noLines')}</p>
          ) : (
            grouped.map((g) => (
              <div key={g.employeeId} className="rounded-lg border border-border">
                <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{g.employeeName}</p>
                    {g.title && <p className="text-xs text-muted-foreground">{g.title}</p>}
                  </div>
                  <p className="text-sm font-semibold text-foreground">{formatCurrency(g.subtotal, invoice.currencyCountry)}</p>
                </div>
                <table className="w-full text-sm">
                  <tbody>
                    {g.lines.map((l) => (
                      <tr key={l.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">
                          <span className="text-foreground">{l.label}</span>
                          {l.manual && <Badge variant="purple" className="ml-2">{t('facturacion.bonus.tag')}</Badge>}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {l.type === 'base' || l.type === 'overtime' ? `${l.quantity} × ${formatCurrency(l.rate, invoice.currencyCountry)}` : l.type === 'percentage' ? '' : `${l.quantity} ×`}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-foreground">{formatCurrency(l.amount, invoice.currencyCountry)}</td>
                        {editable && (
                          <td className="w-10 px-2 py-2 text-right">
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleRemoveLine(l.id)}><X className="h-4 w-4" /></Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm font-medium text-muted-foreground">{t('common.total')}</span>
            <span className="text-2xl font-bold text-emerald-600">{formatCurrency(invoice.total, invoice.currencyCountry)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Meta: issue date + notes */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('facturacion.invoices.details')}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{t('facturacion.pdf.issueDate')}</label>
            <Input type="date" value={invoice.issueDate} disabled={!editable} onChange={(e) => updateInvoice(invoice.id, { issueDate: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">{t('facturacion.clients.notes')}</label>
            <Textarea rows={2} value={invoice.notes} disabled={!editable} onChange={(e) => updateInvoice(invoice.id, { notes: e.target.value })} />
          </div>
          {invoice.payrollRunIds.length > 0 && (
            <p className="sm:col-span-2 flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />{t('facturacion.invoices.sourceRuns', { count: invoice.payrollRunIds.length })}
            </p>
          )}
        </CardContent>
      </Card>

      <BonusLineDialog open={bonusOpen} onOpenChange={setBonusOpen} employees={employeesInInvoice} suggestions={bonusSuggestions} onAdd={handleAddBonus} />
    </div>
  )
}

interface Group { employeeId: string; employeeName: string; title: string; lines: InvoiceLineItem[]; subtotal: number }

function groupByEmployee(lines: InvoiceLineItem[]): Group[] {
  const map = new Map<string, Group>()
  for (const l of lines) {
    const g = map.get(l.employeeId) ?? { employeeId: l.employeeId, employeeName: l.employeeName, title: l.title, lines: [], subtotal: 0 }
    g.lines.push(l)
    g.subtotal += l.amount
    map.set(l.employeeId, g)
  }
  return [...map.values()]
}
