import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Loader2, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { fetchUpcomingEvents, GoogleAuthError, type GoogleCalendarEvent } from '@/lib/google'

// Google Calendar colorId → hex (subset of the standard event palette).
const COLOR_MAP: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6bf26', '6': '#f4511e', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#0b8043', '11': '#d50000',
}

export function CalendarWidget() {
  const { t, i18n } = useTranslation()
  const { googleProviderToken, reconnectGoogle } = useAuth()
  const [loading, setLoading] = useState<boolean>(!!googleProviderToken)
  const [events, setEvents] = useState<GoogleCalendarEvent[]>([])
  const [available, setAvailable] = useState<boolean>(!!googleProviderToken)

  const token = googleProviderToken
  const locale = i18n.language.startsWith('es') ? 'es-DO' : 'en-US'

  const load = useCallback(async () => {
    if (!token) { setAvailable(false); setLoading(false); return }
    setLoading(true)
    try {
      const now = new Date()
      const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const items = await fetchUpcomingEvents(token, now.toISOString(), in7.toISOString())
      setEvents(items)
      setAvailable(true)
    } catch (e) {
      if (e instanceof GoogleAuthError) console.warn('[calendar] Google auth failed')
      else console.warn('[calendar] Calendar unavailable', e)
      setAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  const formatWhen = (ev: GoogleCalendarEvent): string => {
    if (!ev.start) return ''
    const d = new Date(ev.start)
    if (ev.isAllDay) return d.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric' })
    return d.toLocaleString(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-4 w-4 text-emerald-600" />
          {t('suiteHome.calendar.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !available ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t('suiteHome.calendar.unavailable')}</p>
            <Button variant="outline" size="sm" onClick={() => void reconnectGoogle()}>
              {t('suiteHome.google.reconnect')}
            </Button>
          </div>
        ) : events.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('suiteHome.calendar.empty')}</p>
        ) : (
          <ul className="flex-1 space-y-2 overflow-auto">
            {events.map((ev) => (
              <li key={ev.id}>
                <a
                  href={ev.htmlLink}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-secondary"
                >
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: ev.colorId ? COLOR_MAP[ev.colorId] ?? '#059669' : '#059669' }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{ev.summary}</span>
                    <span className="block text-xs text-muted-foreground">{formatWhen(ev)}</span>
                  </span>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
