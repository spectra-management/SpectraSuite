import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Loader2, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { fetchRecentEmails, GoogleAuthError, type GmailMessage } from '@/lib/google'

export function EmailsWidget() {
  const { t, i18n } = useTranslation()
  const { googleProviderToken, reconnectGoogle } = useAuth()
  const [loading, setLoading] = useState<boolean>(!!googleProviderToken)
  const [emails, setEmails] = useState<GmailMessage[]>([])
  const [available, setAvailable] = useState<boolean>(!!googleProviderToken)

  const token = googleProviderToken
  const locale = i18n.language.startsWith('es') ? 'es-DO' : 'en-US'

  const load = useCallback(async () => {
    if (!token) { setAvailable(false); setLoading(false); return }
    setLoading(true)
    try {
      const items = await fetchRecentEmails(token, 5)
      setEmails(items)
      setAvailable(true)
    } catch (e) {
      if (e instanceof GoogleAuthError) console.warn('[emails] Google auth failed')
      else console.warn('[emails] Gmail unavailable', e)
      setAvailable(false)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  // Relative time: "just now" → "5m ago" → "3h ago" → "Yesterday" → localized date.
  const relativeTime = (raw: string): string => {
    if (!raw) return ''
    const then = new Date(raw)
    if (Number.isNaN(then.getTime())) return ''
    const diffMs = Date.now() - then.getTime()
    const min = Math.round(diffMs / 60000)
    if (min < 1) return t('suiteHome.time.now')
    if (min < 60) return t('suiteHome.time.minutes', { n: min })
    const hours = Math.round(min / 60)
    if (hours < 24) return t('suiteHome.time.hours', { n: hours })
    if (hours < 48) return t('suiteHome.time.yesterday')
    return then.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4 text-emerald-600" />
          {t('suiteHome.emails.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !available ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">{t('suiteHome.emails.unavailable')}</p>
            <Button variant="outline" size="sm" onClick={() => void reconnectGoogle()}>
              {t('suiteHome.google.reconnect')}
            </Button>
          </div>
        ) : emails.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('suiteHome.emails.empty')}</p>
        ) : (
          <ul className="flex-1 space-y-1 overflow-auto">
            {emails.map((m) => (
              <li key={m.id}>
                <a
                  href={m.link}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-secondary"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${m.unread ? 'bg-emerald-500' : 'bg-transparent'}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm ${m.unread ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
                        {m.fromName}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(m.date)}</span>
                    </span>
                    <span className={`block truncate text-xs ${m.unread ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                      {m.subject}
                    </span>
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
