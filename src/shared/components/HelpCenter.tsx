import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HelpCircle, ChevronDown, Search } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'
import { useAuth } from '@/shared/context/AuthContext'
import { isSupabaseConfigured } from '@/shared/lib/supabase'
import { MANUAL, type ManualSection, type ManualAccess, type ManualLang } from '@/shared/help/manualContent'

/**
 * Floating "?" Help Center. Opens the in-app user manual, showing ONLY the sections the
 * signed-in user can access (by role / module permissions). Rendered once at the app root.
 */
export function HelpCenter() {
  const { t, i18n } = useTranslation()
  const { user, isManager, isSuperAdmin, hasModuleAccess } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const lang: ManualLang = i18n.language.startsWith('es') ? 'es' : 'en'

  const canAccess = useMemo(() => {
    return (access: ManualAccess): boolean => {
      switch (access.kind) {
        case 'everyone': return true
        case 'manager': return isManager
        case 'superadmin': return isSuperAdmin
        case 'module': return hasModuleAccess(access.module)
        default: return false
      }
    }
  }, [isManager, isSuperAdmin, hasModuleAccess])

  const sections = useMemo(() => {
    const visible = MANUAL.filter((s) => canAccess(s.access))
    const q = query.trim().toLowerCase()
    if (!q) return visible
    return visible.filter((s) => {
      const hay = [
        s.title[lang], s.intro[lang],
        ...s.blocks.flatMap((b) => [b.heading[lang], ...b.items.map((i) => i[lang])]),
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [canAccess, query, lang])

  // Only show for signed-in users (auth disabled in local builds → always show).
  if (isSupabaseConfigured && !user) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('help.open')}
        title={t('help.open')}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 transition-all hover:bg-emerald-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        <HelpCircle className="h-6 w-6" strokeWidth={1.75} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-hidden p-0">
          <DialogHeader className="border-b border-border px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-emerald-600" />
              {t('help.title')}
            </DialogTitle>
            <DialogDescription>{t('help.subtitle')}</DialogDescription>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('help.search')}
                className="pl-9"
              />
            </div>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
            {sections.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">{t('help.noResults')}</p>
            ) : (
              <div className="space-y-2">
                {sections.map((s) => (
                  <ManualRow
                    key={s.id}
                    section={s}
                    lang={lang}
                    open={expanded === s.id || !!query.trim()}
                    onToggle={() => setExpanded((cur) => (cur === s.id ? null : s.id))}
                  />
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ManualRow({
  section, lang, open, onToggle,
}: { section: ManualSection; lang: ManualLang; open: boolean; onToggle: () => void }) {
  const Icon = section.icon
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">{section.title[lang]}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <p className="text-sm text-muted-foreground">{section.intro[lang]}</p>
          {section.blocks.map((b, i) => (
            <div key={i}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">{b.heading[lang]}</p>
              <ul className="space-y-1.5">
                {b.items.map((item, j) => (
                  <li key={j} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                    <span>{item[lang]}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
