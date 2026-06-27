import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Megaphone, Pin } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { usePortalNewsStore } from '@/shared/store/portalNewsStore'

/** Read-only announcements board shown to employees on the self-service mini-home. */
export function NewsBoard() {
  const { t, i18n } = useTranslation()
  const items = usePortalNewsStore((s) => s.items)
  const load = usePortalNewsStore((s) => s.load)

  useEffect(() => { void load() }, [load])

  const fmtDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language.startsWith('es') ? 'es-DO' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    }) : ''

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Megaphone className="h-4 w-4" strokeWidth={1.75} />
          </span>
          {t('news.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('news.empty')}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((n) => (
              <li key={n.id} className="rounded-lg border border-border p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{n.title}</h3>
                  {n.pinned && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                      <Pin className="h-3 w-3" />{t('news.pinned')}
                    </span>
                  )}
                </div>
                {n.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1.5 text-[11px] text-muted-foreground">{fmtDate(n.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
