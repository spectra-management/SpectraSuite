import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ScrollText, Download, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/useToast'
import type { AuditLogRow, AuditCategory } from '@/types/supabase'

const CATEGORIES: AuditCategory[] = ['auth', 'user_management', 'payroll', 'vacation', 'settings', 'connector']
const PAGE_SIZE = 20
const FETCH_LIMIT = 500

export function AuditLogPanel() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith('es') ? 'es-DO' : 'en-US'
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [category, setCategory] = useState<string>('all')
  const [status, setStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT)
    if (error) toast({ variant: 'destructive', title: t('audit.loadError') })
    setRows(data ?? [])
    setLoading(false)
  }, [t])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (category !== 'all' && r.category !== category) return false
      if (status !== 'all' && r.status !== status) return false
      if (fromDate && r.created_at < fromDate) return false
      if (toDate && r.created_at > `${toDate}T23:59:59`) return false
      if (q) {
        const hay = `${r.user_email ?? ''} ${r.action} ${r.resource_type ?? ''} ${r.resource_id ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [rows, category, status, search, fromDate, toDate])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const exportCsv = () => {
    const headers = ['timestamp', 'user_email', 'action', 'category', 'resource_type', 'resource_id', 'status', 'error_message']
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const lines = [
      headers.join(','),
      ...filtered.map((r) => [
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
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0} className="gap-1.5">
            <Download className="h-4 w-4" /> {t('audit.exportCsv')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder={t('audit.search')} className="pl-8" />
          </div>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1) }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('audit.allCategories')}</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{t(`audit.category.${c}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1) }}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('audit.allStatuses')}</SelectItem>
              <SelectItem value="success">{t('audit.success')}</SelectItem>
              <SelectItem value="failure">{t('audit.failure')}</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1) }} className="w-36" />
          <Input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1) }} className="w-36" />
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
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
                  {paginated.map((r) => (
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
              <span>{t('common.showing', { count: paginated.length, total: filtered.length })}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t('common.back')}
                </Button>
                <span>{safePage} / {totalPages}</span>
                <Button variant="outline" size="sm" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>
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
