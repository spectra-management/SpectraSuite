import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Cake, CalendarClock, ArrowRight, PartyPopper } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { useCompanyCalendarStore } from '@/shared/store/companyCalendarStore'

/** Local YYYY-MM-DD for "today". */
function todayParts() {
  const d = new Date()
  return { month: d.getMonth() + 1, day: d.getDate(), iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
}

/** Highlights who has a birthday today and today's company events. */
export function TodayHighlights() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const events = useCompanyCalendarStore((s) => s.events)
  const birthdays = useCompanyCalendarStore((s) => s.birthdays)
  const loadAll = useCompanyCalendarStore((s) => s.loadAll)

  useEffect(() => { void loadAll() }, [loadAll])

  const { month, day, iso } = todayParts()
  const birthdaysToday = useMemo(
    () => birthdays.filter((b) => b.month === month && b.day === day),
    [birthdays, month, day],
  )
  const eventsToday = useMemo(() => events.filter((e) => e.date === iso), [events, iso])

  return (
    <Card className="h-full overflow-hidden border-t-2 border-t-emerald-600">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <PartyPopper className="h-4 w-4" strokeWidth={1.75} />
          </span>
          {t('calendar.today')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Birthdays today */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Cake className="h-3.5 w-3.5" />{t('calendar.birthdaysToday')}
          </p>
          {birthdaysToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('calendar.noBirthdaysToday')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {birthdaysToday.map((b) => (
                <span key={b.id} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  🎂 {b.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Events today */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />{t('calendar.eventsToday')}
          </p>
          {eventsToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('calendar.noEventsToday')}</p>
          ) : (
            <ul className="space-y-1.5">
              {eventsToday.map((e) => (
                <li key={e.id} className="rounded-lg border border-border px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{e.title}</p>
                  {e.description && <p className="text-xs text-muted-foreground">{e.description}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate('/calendar')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800 dark:text-emerald-400"
        >
          {t('calendar.openFull')} <ArrowRight className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  )
}
