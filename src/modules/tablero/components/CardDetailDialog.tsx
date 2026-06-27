import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Plus, X, Calendar, User, MessageSquare, CheckSquare } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/shared/components/ui/dialog'
import { cn } from '@/shared/lib/utils'
import { useAuth } from '@/shared/context/AuthContext'
import { useBoardStore } from '../store/boardStore'
import { CARD_LABEL_COLORS, type BoardCard, type ChecklistItem, type CardComment } from '../lib/types'

const uuid = () => crypto.randomUUID()

const LABEL_BG: Record<string, string> = {
  emerald: 'bg-emerald-500', blue: 'bg-blue-500', amber: 'bg-amber-500',
  red: 'bg-red-500', purple: 'bg-purple-500', gray: 'bg-gray-400',
}

export function CardDetailDialog({ card, onClose }: { card: BoardCard | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const updateCard = useBoardStore((s) => s.updateCard)
  const removeCard = useBoardStore((s) => s.removeCard)

  const [draft, setDraft] = useState<BoardCard | null>(card)
  const [newChecklist, setNewChecklist] = useState('')
  const [newComment, setNewComment] = useState('')

  useEffect(() => { setDraft(card) }, [card])

  if (!draft) return null

  const commit = (next: BoardCard) => { setDraft(next); updateCard(next) }

  const toggleLabel = (color: string) => {
    const labels = draft.labels.includes(color)
      ? draft.labels.filter((l) => l !== color)
      : [...draft.labels, color]
    commit({ ...draft, labels })
  }

  const addChecklistItem = () => {
    const text = newChecklist.trim()
    if (!text) return
    const item: ChecklistItem = { id: uuid(), text, done: false }
    commit({ ...draft, checklist: [...draft.checklist, item] })
    setNewChecklist('')
  }
  const toggleChecklist = (id: string) =>
    commit({ ...draft, checklist: draft.checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) })
  const removeChecklist = (id: string) =>
    commit({ ...draft, checklist: draft.checklist.filter((c) => c.id !== id) })

  const addComment = () => {
    const body = newComment.trim()
    if (!body) return
    const comment: CardComment = {
      id: uuid(), author: profile?.full_name || profile?.email || '—', body,
      createdAt: new Date().toISOString(),
    }
    commit({ ...draft, comments: [...draft.comments, comment] })
    setNewComment('')
  }
  const removeComment = (id: string) =>
    commit({ ...draft, comments: draft.comments.filter((c) => c.id !== id) })

  const doneCount = draft.checklist.filter((c) => c.done).length

  return (
    <Dialog open={!!card} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">{t('tablero.card.detail')}</DialogTitle>
          <Input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onBlur={() => commit(draft)}
            className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
            placeholder={t('tablero.card.titlePlaceholder')}
          />
        </DialogHeader>

        <div className="space-y-5">
          {/* Labels */}
          <section>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('tablero.card.labels')}</p>
            <div className="flex flex-wrap gap-1.5">
              {CARD_LABEL_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => toggleLabel(color)}
                  className={cn(
                    'h-7 w-10 rounded-md transition-all',
                    LABEL_BG[color],
                    draft.labels.includes(color) ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'opacity-60 hover:opacity-100',
                  )}
                  aria-label={color}
                />
              ))}
            </div>
          </section>

          {/* Assignee + Due date */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <User className="h-3.5 w-3.5" />{t('tablero.card.assignee')}
              </label>
              <Input
                value={draft.assignee}
                onChange={(e) => setDraft({ ...draft, assignee: e.target.value })}
                onBlur={() => commit(draft)}
                placeholder={t('tablero.card.assigneePlaceholder')}
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />{t('tablero.card.dueDate')}
              </label>
              <Input
                type="date"
                value={draft.dueDate}
                onChange={(e) => commit({ ...draft, dueDate: e.target.value })}
              />
            </div>
          </div>

          {/* Description */}
          <section>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('tablero.card.description')}</p>
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              onBlur={() => commit(draft)}
              placeholder={t('tablero.card.descriptionPlaceholder')}
              rows={3}
            />
          </section>

          {/* Checklist */}
          <section>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <CheckSquare className="h-3.5 w-3.5" />{t('tablero.card.checklist')}
              {draft.checklist.length > 0 && <span className="ml-1 text-muted-foreground">{doneCount}/{draft.checklist.length}</span>}
            </p>
            <div className="space-y-1.5">
              {draft.checklist.map((item) => (
                <div key={item.id} className="group flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-secondary">
                  <Checkbox checked={item.done} onCheckedChange={() => toggleChecklist(item.id)} />
                  <span className={cn('flex-1 text-sm', item.done && 'text-muted-foreground line-through')}>{item.text}</span>
                  <button
                    type="button"
                    onClick={() => removeChecklist(item.id)}
                    className="text-muted-foreground opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                    aria-label={t('common.delete')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={newChecklist}
                onChange={(e) => setNewChecklist(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem() }}
                placeholder={t('tablero.card.addChecklist')}
                className="h-9"
              />
              <Button size="sm" variant="outline" onClick={addChecklistItem}><Plus className="h-4 w-4" /></Button>
            </div>
          </section>

          {/* Comments */}
          <section>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />{t('tablero.card.comments')}
            </p>
            <div className="space-y-2">
              {draft.comments.map((c) => (
                <div key={c.id} className="group rounded-lg border border-border bg-secondary/40 p-2.5">
                  <div className="mb-0.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">{c.author}</span>
                    <button
                      type="button"
                      onClick={() => removeComment(c.id)}
                      className="text-muted-foreground opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                      aria-label={t('common.delete')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{c.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addComment() }}
                placeholder={t('tablero.card.addComment')}
                className="h-9"
              />
              <Button size="sm" variant="outline" onClick={addComment}><Plus className="h-4 w-4" /></Button>
            </div>
          </section>

          {/* Delete card */}
          <div className="flex justify-end border-t border-border pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"
              onClick={() => { removeCard(draft.id); onClose() }}
            >
              <Trash2 className="h-4 w-4" />
              {t('tablero.card.delete')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
