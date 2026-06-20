import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/shared/components/ui/dialog'
import { toast } from '@/shared/hooks/useToast'
import { cn } from '@/shared/lib/utils'
import {
  HOLIDAY_COUNTRIES, getHolidays, getLastSync, syncHolidays,
  addManualHoliday, updateHoliday, deleteHoliday, type Holiday,
} from '@/modules/nomina/lib/holidays'

const FLAG: Record<string, string> = {
  'Dominican Republic': '🇩🇴', Mexico: '🇲🇽', 'United States': '🇺🇸',
  Jamaica: '🇯🇲', Philippines: '🇵🇭', Kenya: '🇰🇪',
}

const todayStr = new Date().toISOString().slice(0, 10)

interface FormState { id: string | null; date: string; name: string; note: string }
const EMPTY_FORM: FormState = { id: null, date: '', name: '', note: '' }

export function HolidaysTab() {
  const { t, i18n } = useTranslation()
  const currentYear = new Date().getFullYear()

  const [country, setCountry] = useState<string>(HOLIDAY_COUNTRIES[0])
  const [year, setYear] = useState(currentYear)
  const [syncing, setSyncing] = useState(false)
  const [tick, setTick] = useState(0)            // bump to re-read from localStorage
  const [lastSync, setLastSyncState] = useState<string | null>(getLastSync())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const refresh = () => setTick((n) => n + 1)

  const runSync = async (silent = false) => {
    setSyncing(true)
    try {
      const { failed } = await syncHolidays(year)
      setLastSyncState(getLastSync())
      refresh()
      if (!silent) {
        if (failed.length) toast({ variant: 'destructive', title: t('settings.holidays.syncFailed', { countries: failed.join(', ') }) })
        else toast({ variant: 'success', title: t('settings.holidays.syncDone') })
      }
    } catch {
      if (!silent) toast({ variant: 'destructive', title: t('settings.holidays.syncFailed', { countries: country }) })
    } finally {
      setSyncing(false)
    }
  }

  // Auto-sync silently on first mount if nothing is stored for the current year.
  useEffect(() => {
    const anyForYear = HOLIDAY_COUNTRIES.some((c) => getHolidays(c, currentYear).length > 0)
    if (!anyForYear) void runSync(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const counts = useMemo(() => {
    void tick
    return Object.fromEntries(HOLIDAY_COUNTRIES.map((c) => [c, getHolidays(c, year).length]))
  }, [year, tick])

  const holidays = useMemo(() => {
    void tick
    return getHolidays(country, year)
  }, [country, year, tick])

  const upcoming = holidays.filter((h) => h.date >= todayStr)
  const past = holidays.filter((h) => h.date < todayStr)

  const openAdd = () => { setForm({ ...EMPTY_FORM, date: `${year}-01-01` }); setDialogOpen(true) }
  const openEdit = (h: Holiday) => { setForm({ id: h.id, date: h.date, name: h.name, note: h.note ?? '' }); setDialogOpen(true) }

  const handleSave = () => {
    if (!form.date || !form.name.trim()) {
      toast({ variant: 'destructive', title: t('errors.required') })
      return
    }
    const ok = form.id
      ? updateHoliday(country, year, form.id, { date: form.date, name: form.name.trim(), note: form.note.trim() })
      : addManualHoliday(country, year, form.date, form.name.trim(), form.note.trim())
    if (!ok) {
      toast({ variant: 'destructive', title: t('settings.holidays.duplicate') })
      return
    }
    setDialogOpen(false)
    refresh()
    toast({ variant: 'success', title: t('common.success') })
  }

  const handleDelete = (h: Holiday) => {
    if (!window.confirm(t('settings.holidays.deleteConfirm'))) return
    deleteHoliday(country, year, h.id)
    refresh()
  }

  const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString(i18n.language?.startsWith('es') ? 'es-DO' : 'en-US', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    })

  const fmtSync = lastSync
    ? new Date(lastSync).toLocaleString(i18n.language?.startsWith('es') ? 'es-DO' : 'en-US')
    : t('settings.holidays.neverSynced')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>{t('settings.holidays.title')}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{t('settings.holidays.subtitle')}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t('settings.holidays.lastSync', { time: fmtSync })}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Country tabs */}
        <div className="flex flex-wrap gap-1.5">
          {HOLIDAY_COUNTRIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCountry(c)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                country === c ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-input text-muted-foreground hover:bg-secondary',
              )}
            >
              <span className="text-sm leading-none">{FLAG[c]}</span>
              {c}
              <span className={cn('rounded-full px-1.5 text-[10px] font-semibold', country === c ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground')}>
                {counts[c] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 rounded-lg border border-input p-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm font-semibold tabular-nums">{year}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setYear((y) => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => runSync(false)} disabled={syncing} className="gap-1.5">
              <RefreshCw className={cn('h-3.5 w-3.5', syncing && 'animate-spin')} />
              {syncing ? t('settings.holidays.syncing') : t('settings.holidays.sync')}
            </Button>
            <Button size="sm" onClick={openAdd} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t('settings.holidays.addHoliday')}
            </Button>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5">
          <Info className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
          <p className="text-xs text-blue-700">{t('settings.holidays.info')}</p>
        </div>

        {/* Table */}
        {holidays.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('settings.holidays.none')}</p>
        ) : (
          <div className="space-y-4">
            {upcoming.length > 0 && (
              <HolidaySection title={t('settings.holidays.upcoming')} rows={upcoming} onEdit={openEdit} onDelete={handleDelete} fmtDate={fmtDate} t={t} />
            )}
            {past.length > 0 && (
              <HolidaySection title={t('settings.holidays.past')} rows={past} onEdit={openEdit} onDelete={handleDelete} fmtDate={fmtDate} t={t} dim />
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>{t('settings.holidays.totalCount', { count: holidays.length })}</span>
          <span>{t('settings.holidays.legend')}</span>
        </div>
      </CardContent>

      {/* Add / Edit modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? t('settings.holidays.editTitle') : t('settings.holidays.addTitle')}</DialogTitle>
            <DialogDescription className="sr-only">{country} · {year}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t('settings.holidays.fieldDate')}</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings.holidays.fieldName')}</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings.holidays.fieldNote')}</Label>
              <Input
                value={form.note}
                placeholder={t('settings.holidays.notePlaceholder')}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function SourceBadge({ source, t }: { source: Holiday['source']; t: (k: string) => string }) {
  if (source === 'manual') {
    return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600 border border-blue-200">✎ {t('settings.holidays.manual')}</span>
  }
  return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-200">✦ {t('settings.holidays.auto')}</span>
}

function HolidaySection({
  title, rows, onEdit, onDelete, fmtDate, t, dim,
}: {
  title: string
  rows: Holiday[]
  onEdit: (h: Holiday) => void
  onDelete: (h: Holiday) => void
  fmtDate: (d: string) => string
  t: (k: string, o?: Record<string, unknown>) => string
  dim?: boolean
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{title}</p>
      <div className={cn('overflow-hidden rounded-xl border border-border', dim && 'opacity-50')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2">{t('settings.holidays.colDate')}</th>
              <th className="px-4 py-2">{t('settings.holidays.colName')}</th>
              <th className="px-4 py-2">{t('settings.holidays.colSource')}</th>
              <th className="px-4 py-2 text-right">{t('settings.holidays.colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((h) => (
              <tr key={h.id} className="hover:bg-secondary">
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">{fmtDate(h.date)}</td>
                <td className="px-4 py-2 text-foreground">
                  {h.name}
                  {h.note && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                      {h.note}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2"><SourceBadge source={h.source} t={t} /></td>
                <td className="px-4 py-2">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(h)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(h)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
