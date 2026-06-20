import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ScrollText, Download, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/shared/components/ui/select'
import { toast } from '@/shared/hooks/useToast'
import { useAuditLog } from '@/shared/hooks/useAuditLog'
import type { AuditCategory, AuditLogRow } from '@/shared/types/supabase'

const CATEGORIES: AuditCategory[] = ['auth', 'user_management', 'payroll', 'vacation', 'settings', 'connector']
const PAGE_SIZE = 25

export function AuditLogPanel() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('es') ? 'es-DO' : 'en-US'

  // Filter UI state — combined into a single object passed to the hook, which
  // re-queries the server (page 0) whenever it changes.
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [exporting, setExporting] = useState(false)

  const filters = useMemo(
    () => ({ search, category, status, startDate: fromDate, endDate: toDate }),
    [search, category, status, fromDate, toDate],
  )

  const {
    logs, page, totalCount, totalPages, loading, error,
    nextPage, prevPage, hasNextPage, hasPrevPage, fetchForExport,
  } = useAuditLog({ pageSize: PAGE_SIZE, filters })

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows = await fetchForExport()
      const headers = ['timestamp', 'user_email', 'action', 'category', 'resource_type', 'resource_id', 'status', 'error_message']
      const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const lines = [
        headers.join(','),
        ...rows.map((r: AuditLogRow) => [
          r.created_at, r.user_email, r.action, r.category, r.resource_type, r.resource_id, r.status, r.error_message,
        ].map(escape).join(',')),
      ]
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ variant: 'destructive', title: t('audit.loadError'), description: (e as Error).message })
    } finally {
      setExporting(false)
    }
  }

  if (error) {
    // Surface load failures (e.g. RLS / not super_admin) without crashing the panel.
    console.error('[audit] viewer error:', error)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-emerald-600" />
              {t('audit.title')}
            </CardTitle>
            <CardDescription>{t('audit.subtitle')}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void exportCsv()} disabled={exporting || totalCount === 0} className="gap-1.5">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} {t('audit.exportCsv')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters (server-side) */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('audit.search')} className="pl-8" />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('audit.allCategories')}</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`audit.category.${c}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('audit.allStatuses')}</SelectItem>
              <SelectItem value="success">{t('audit.success')}</SelectItem>
              <SelectItem value="failure">{t('audit.failure')}</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-36" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-36" />
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('audit.empty')}</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[44rem] text-sm">
                <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">{t('audit.col.time')}</th>
                    <th className="px-3 py-2 text-left">{t('audit.col.user')}</th>
                    <th className="px-3 py-2 text-left">{t('audit.col.action')}</th>
                    <th className="px-3 py-2 text-left">{t('audit.col.category')}</th>
                    <th className="px-3 py-2 text-left">{t('audit.col.resource')}</th>
                    <th className="px-3 py-2 text-left">{t('audit.col.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((r) => (
                    <tr key={r.id} className="hover:bg-secondary">
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="max-w-[12rem] truncate px-3 py-2 text-xs text-foreground">{r.user_email ?? '—'}</td>
                      <td className="px-3 py-2 text-xs font-medium text-foreground">{r.action}</td>
                      <td className="px-3 py-2"><Badge variant="secondary">{t(`audit.category.${r.category}`)}</Badge></td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.resource_type ? `${r.resource_type}${r.resource_id ? ` · ${r.resource_id.slice(0, 8)}` : ''}` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={r.status === 'success' ? 'default' : 'destructive'}>
                          {t(`audit.${r.status}`)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('common.showing', { count: logs.length, total: totalCount })}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={!hasPrevPage} onClick={prevPage}>
                  {t('common.back')}
                </Button>
                <span>{page + 1} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={!hasNextPage} onClick={nextPage}>
                  {t('common.next')}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
