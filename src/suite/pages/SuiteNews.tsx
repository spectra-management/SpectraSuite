import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Pencil, Trash2, Pin, Megaphone } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Switch } from '@/shared/components/ui/switch'
import { Label } from '@/shared/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/components/ui/dialog'
import { UserMenu } from '@/shared/components/layout/UserMenu'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { Toaster } from '@/shared/components/ui/toaster'
import { toast } from '@/shared/hooks/useToast'
import { usePortalNewsStore, type NewsItem } from '@/shared/store/portalNewsStore'

interface Draft { id: string | null; title: string; body: string; pinned: boolean }
const EMPTY: Draft = { id: null, title: '', body: '', pinned: false }

/** Manager-only news/announcements manager (route gated with requireManager). */
export default function SuiteNews() {
  const { t, i18n } = useTranslation()
  const items = usePortalNewsStore((s) => s.items)
  const load = usePortalNewsStore((s) => s.load)
  const create = usePortalNewsStore((s) => s.create)
  const update = usePortalNewsStore((s) => s.update)
  const remove = usePortalNewsStore((s) => s.remove)
  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en'

  const [draft, setDraft] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<NewsItem | null>(null)

  useEffect(() => { document.title = `${t('news.manageTitle')} | Spectra Suite` }, [t])
  useEffect(() => { void load() }, [load])

  const fmtDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString(currentLang === 'es' ? 'es-DO' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    }) : ''

  const save = async () => {
    if (!draft || !draft.title.trim()) return
    if (draft.id) {
      const existing = items.find((n) => n.id === draft.id)
      if (existing) await update({ ...existing, title: draft.title.trim(), body: draft.body.trim(), pinned: draft.pinned })
    } else {
      await create({ title: draft.title, body: draft.body, pinned: draft.pinned })
    }
    setDraft(null)
    toast({ variant: 'success', title: t('common.success') })
  }

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
        <div className="mx-auto w-full max-w-3xl">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{t('news.manageTitle')}</h1>
              <p className="text-sm text-muted-foreground">{t('news.manageSubtitle')}</p>
            </div>
            <Button onClick={() => setDraft({ ...EMPTY })}>
              <Plus className="h-4 w-4" />{t('news.new')}
            </Button>
          </div>

          {items.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <Megaphone className="h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">{t('news.empty')}</p>
                <Button onClick={() => setDraft({ ...EMPTY })}><Plus className="h-4 w-4" />{t('news.new')}</Button>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {items.map((n) => (
                <li key={n.id}>
                  <Card>
                    <CardContent className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{n.title}</h3>
                          {n.pinned && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                              <Pin className="h-3 w-3" />{t('news.pinned')}
                            </span>
                          )}
                        </div>
                        {n.body && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{n.body}</p>}
                        <p className="mt-1.5 text-[11px] text-muted-foreground">{fmtDate(n.createdAt)}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button" aria-label={t('common.edit')}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                          onClick={() => setDraft({ id: n.id, title: n.title, body: n.body, pinned: n.pinned })}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button" aria-label={t('common.delete')}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                          onClick={() => setDeleting(n)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Create / edit */}
      <Dialog open={!!draft} onOpenChange={(o) => { if (!o) setDraft(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{draft?.id ? t('news.edit') : t('news.new')}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('news.fieldTitle')}</Label>
                <Input autoFocus value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={t('news.fieldTitle')} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('news.fieldBody')}</Label>
                <Textarea rows={5} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} placeholder={t('news.fieldBody')} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Pin className="h-4 w-4 text-muted-foreground" />{t('news.pin')}
                </div>
                <Switch checked={draft.pinned} onCheckedChange={(c) => setDraft({ ...draft, pinned: c })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>{t('common.cancel')}</Button>
            <Button onClick={() => void save()} disabled={!draft?.title.trim()}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('news.deleteTitle')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('news.deleteConfirm', { title: deleting?.title })}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => { if (deleting) { void remove(deleting.id); setDeleting(null) } }}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  )
}
