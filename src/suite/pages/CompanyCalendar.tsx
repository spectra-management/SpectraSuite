import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Cake, Trash2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Label } from '@/shared/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/components/ui/dialog'
import { UserMenu } from '@/shared/components/layout/UserMenu'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { Toaster } from '@/shared/components/ui/toaster'
import { toast } from '@/shared/hooks/useToast'
import { cn } from '@/shared/lib/utils'
import { useAuth } from '@/shared/context/AuthContext'
import { useCompanyCalendarStore, type CompanyEvent } from '@/shared/store/companyCalendarStore'

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

interface Draft { id: string | null; title: string; description: string; date: string }

/** Company calendar: activities + everyone's birthdays. Managers can manage events. */
export default function CompanyCalendar() {
  const { t, i18n } = useTranslation()
  const { isManager } = useAuth()
  const events = useCompanyCalendarStore((s) => s.events)
  const birthdays = useCompanyCalendarStore((s) => s.birthdays)
  const loadAll = useCompanyCalendarStore((s) => s.loadAll)
  const createEvent = useCompanyCalendarStore((s) => s.createEvent)
  const updateEvent = useCompanyCalendarStore((s) => s.updateEvent)
  const removeEvent = useCompanyCalendarStore((s) => s.removeEvent)

  const locale = i18n.language.startsWith('es') ? 'es-DO' : 'en-US'
  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en'
  const today = new Date()
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [draft, setDraft] = useState<Draft | null>(null)

  useEffect(() => { document.title = `${t('calendar.title')} | Spectra Suite` }, [t])
  useEffect(() => { void loadAll() }, [loadAll])

  // Index events and birthdays by day-of-month for the visible month.
  const eventsByDay = useMemo(() => {
    const map: Record<number, CompanyEvent[]> = {}
    for (const e of events) {
      const [y, m, d] = e.date.split('-').map(Number)
      if (y === view.year && m - 1 === view.month) (map[d] ??= []).push(e)
    }
    return map
  }, [events, view])

  const birthdaysByDay = useMemo(() => {
    const map: Record<number, string[]> = {}
    for (const b of birthdays) if (b.month - 1 === view.month) (map[b.day] ??= []).push(b.name)
    return map
  }, [birthdays, view.month])

  const firstWeekday = new Date(view.year, view.month, 1).getDay()
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(locale, { weekday: 'short' }),
  )

  const goMonth = (delta: number) => setView((v) => {
    const m = v.month + delta
    return { year: v.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 }
  })

  const openNew = (day?: number) =>
    setDraft({ id: null, title: '', description: '', date: iso(view.year, view.month, day ?? today.getDate()) })

  const save = async () => {
    if (!draft || !draft.title.trim() || !draft.date) return
    if (draft.id) {
      const existing = events.find((e) => e.id === draft.id)
      if (existing) await updateEvent({ ...existing, title: draft.title.trim(), description: draft.description.trim(), date: draft.date })
    } else {
      await createEvent({ title: draft.title, description: draft.description, date: draft.date, allDay: true })
    }
    setDraft(null)
    toast({ variant: 'success', title: t('common.success') })
  }

  const isToday = (day: number) =>
    view.year === today.getFullYear() && view.month === today.getMonth() && day === today.getDate()

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-8">
          <Link to="/suite" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400">
            <ArrowLeft className="h-4 w-4" /> {t('suite.backToSuite')}
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => i18n.changeLanguage(currentLang === 'en' ? 'es' : 'en')} className="font-semibold tracking-wide" aria-label="Toggle language">
              {currentLang === 'en' ? 'ES' : 'EN'}
            </Button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('calendar.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('calendar.subtitle')}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => goMonth(-1)} aria-label={t('calendar.prev')}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="min-w-[9rem] text-center text-sm font-semibold capitalize text-foreground">{monthLabel}</span>
              <Button variant="outline" size="sm" onClick={() => goMonth(1)} aria-label={t('calendar.next')}><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setView({ year: today.getFullYear(), month: today.getMonth() })}>{t('calendar.todayBtn')}</Button>
              {isManager && <Button size="sm" onClick={() => openNew()}><Plus className="h-4 w-4" />{t('calendar.addEvent')}</Button>}
            </div>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
            {weekdays.map((w) => (
              <div key={w} className="bg-secondary px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{w}</div>
            ))}
            {cells.map((day, idx) => (
              <div
                key={idx}
                className={cn('min-h-[5.5rem] bg-card p-1.5 align-top', day && isManager && 'cursor-pointer hover:bg-secondary/50')}
                onClick={day && isManager ? () => openNew(day) : undefined}
              >
                {day && (
                  <>
                    <div className={cn(
                      'mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                      isToday(day) ? 'bg-emerald-600 text-white' : 'text-muted-foreground',
                    )}>{day}</div>
                    <div className="space-y-1">
                      {(birthdaysByDay[day] ?? []).map((name, i) => (
                        <div key={`b${i}`} className="flex items-center gap-1 truncate rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" title={name}>
                          <Cake className="h-3 w-3 shrink-0" /><span className="truncate">{name}</span>
                        </div>
                      ))}
                      {(eventsByDay[day] ?? []).map((e) => (
                        <div
                          key={e.id}
                          onClick={isManager ? (ev) => { ev.stopPropagation(); setDraft({ id: e.id, title: e.title, description: e.description, date: e.date }) } : undefined}
                          className={cn('truncate rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', isManager && 'cursor-pointer')}
                          title={e.title}
                        >
                          {e.title}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Manager: create / edit event */}
      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? t('calendar.editEvent') : t('calendar.addEvent')}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('calendar.eventTitle')}</Label>
                <Input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={t('calendar.eventTitle')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('calendar.eventDate')}</Label>
                <Input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('calendar.eventDescription')}</Label>
                <Textarea rows={3} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder={t('calendar.eventDescription')} />
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-between">
            {draft?.id ? (
              <Button variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10" onClick={() => { if (draft.id) { void removeEvent(draft.id); setDraft(null) } }}>
                <Trash2 className="h-4 w-4" />{t('common.delete')}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDraft(null)}>{t('common.cancel')}</Button>
              <Button onClick={() => void save()} disabled={!draft?.title.trim() || !draft?.date}>{t('common.save')}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  )
}
