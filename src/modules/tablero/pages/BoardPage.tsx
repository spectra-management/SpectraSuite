import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Plus, X, MoreHorizontal, Loader2, Calendar, User, MessageSquare, CheckSquare } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'
import { useBoardStore } from '../store/boardStore'
import { CardDetailDialog } from '../components/CardDetailDialog'
import type { BoardCard } from '../lib/types'

const LABEL_BG: Record<string, string> = {
  emerald: 'bg-emerald-500', blue: 'bg-blue-500', amber: 'bg-amber-500',
  red: 'bg-red-500', purple: 'bg-purple-500', gray: 'bg-gray-400',
}

export function BoardPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { boardId = '' } = useParams()

  const boards = useBoardStore((s) => s.boards)
  const lists = useBoardStore((s) => s.lists)
  const cards = useBoardStore((s) => s.cards)
  const loading = useBoardStore((s) => s.loadingBoard)
  const openBoard = useBoardStore((s) => s.openBoard)
  const addList = useBoardStore((s) => s.addList)
  const renameList = useBoardStore((s) => s.renameList)
  const removeList = useBoardStore((s) => s.removeList)
  const addCard = useBoardStore((s) => s.addCard)
  const moveCard = useBoardStore((s) => s.moveCard)

  const board = boards.find((b) => b.id === boardId)
  const [addingList, setAddingList] = useState(false)
  const [listName, setListName] = useState('')
  const [addingCardTo, setAddingCardTo] = useState<string | null>(null)
  const [cardTitle, setCardTitle] = useState('')
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [dragCardId, setDragCardId] = useState<string | null>(null)
  const [dragOverList, setDragOverList] = useState<string | null>(null)

  useEffect(() => {
    if (boardId) void openBoard(boardId)
  }, [boardId, openBoard])

  const sortedLists = useMemo(() => [...lists].sort((a, b) => a.position - b.position), [lists])
  const cardsByList = useMemo(() => {
    const map: Record<string, BoardCard[]> = {}
    for (const c of cards) (map[c.listId] ??= []).push(c)
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.position - b.position)
    return map
  }, [cards])

  const openCard = cards.find((c) => c.id === openCardId) ?? null

  const submitList = () => {
    if (!listName.trim()) return
    addList(listName.trim())
    setListName('')
    setAddingList(false)
  }
  const submitCard = (listId: string) => {
    if (!cardTitle.trim()) return
    addCard(listId, cardTitle.trim())
    setCardTitle('')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Board header */}
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/tablero/boards')}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
          aria-label={t('tablero.nav.boards')}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold text-foreground">{board?.name ?? t('tablero.brand')}</h1>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
          {sortedLists.map((list) => (
            <div
              key={list.id}
              className={cn(
                'flex max-h-full w-72 shrink-0 flex-col rounded-xl border bg-secondary/40 transition-colors',
                dragOverList === list.id ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-500/5' : 'border-border',
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOverList(list.id) }}
              onDragLeave={() => setDragOverList((cur) => (cur === list.id ? null : cur))}
              onDrop={(e) => {
                e.preventDefault()
                if (dragCardId) moveCard(dragCardId, list.id, null)
                setDragCardId(null); setDragOverList(null)
              }}
            >
              {/* List header */}
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <input
                  defaultValue={list.name}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value !== list.name) renameList(list.id, e.target.value.trim()) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                  className="min-w-0 flex-1 truncate bg-transparent text-sm font-semibold text-foreground outline-none focus:rounded focus:bg-background focus:px-1.5 focus:py-0.5 focus:ring-1 focus:ring-emerald-400"
                />
                <span className="text-xs text-muted-foreground">{cardsByList[list.id]?.length ?? 0}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground" aria-label={t('common.more')}>
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-700"
                      onClick={() => removeList(list.id)}
                    >
                      {t('tablero.list.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
                {(cardsByList[list.id] ?? []).map((card) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => setDragCardId(card.id)}
                    onDragEnd={() => { setDragCardId(null); setDragOverList(null) }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault(); e.stopPropagation()
                      if (dragCardId && dragCardId !== card.id) moveCard(dragCardId, list.id, card.id)
                      setDragCardId(null); setDragOverList(null)
                    }}
                    onClick={() => setOpenCardId(card.id)}
                    className={cn(
                      'cursor-pointer rounded-lg border border-border bg-card p-2.5 shadow-sm transition-all hover:border-emerald-300 hover:shadow',
                      dragCardId === card.id && 'opacity-50',
                    )}
                  >
                    {card.labels.length > 0 && (
                      <div className="mb-1.5 flex flex-wrap gap-1">
                        {card.labels.map((l) => (
                          <span key={l} className={cn('h-1.5 w-8 rounded-full', LABEL_BG[l] ?? 'bg-gray-400')} />
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-foreground">{card.title}</p>
                    {(card.assignee || card.dueDate || card.checklist.length > 0 || card.comments.length > 0) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {card.dueDate && (
                          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{card.dueDate}</span>
                        )}
                        {card.checklist.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <CheckSquare className="h-3 w-3" />{card.checklist.filter((c) => c.done).length}/{card.checklist.length}
                          </span>
                        )}
                        {card.comments.length > 0 && (
                          <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{card.comments.length}</span>
                        )}
                        {card.assignee && (
                          <span className="ml-auto inline-flex items-center gap-1"><User className="h-3 w-3" />{card.assignee}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add card */}
              <div className="px-2 pb-2">
                {addingCardTo === list.id ? (
                  <div className="space-y-1.5">
                    <Input
                      autoFocus
                      value={cardTitle}
                      onChange={(e) => setCardTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitCard(list.id)
                        if (e.key === 'Escape') { setAddingCardTo(null); setCardTitle('') }
                      }}
                      placeholder={t('tablero.card.titlePlaceholder')}
                      className="h-9 bg-card"
                    />
                    <div className="flex gap-1.5">
                      <Button size="sm" onClick={() => submitCard(list.id)}>{t('tablero.card.add')}</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setAddingCardTo(null); setCardTitle('') }}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setAddingCardTo(list.id); setCardTitle('') }}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />{t('tablero.card.add')}
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Add list */}
          <div className="w-72 shrink-0">
            {addingList ? (
              <div className="space-y-1.5 rounded-xl border border-border bg-secondary/40 p-2">
                <Input
                  autoFocus
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitList()
                    if (e.key === 'Escape') { setAddingList(false); setListName('') }
                  }}
                  placeholder={t('tablero.list.namePlaceholder')}
                  className="h-9 bg-card"
                />
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={submitList}>{t('tablero.list.add')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingList(false); setListName('') }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingList(true)}
                className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-emerald-300 hover:text-foreground"
              >
                <Plus className="h-4 w-4" />{t('tablero.list.add')}
              </button>
            )}
          </div>
        </div>
      )}

      <CardDetailDialog card={openCard} onClose={() => setOpenCardId(null)} />
    </div>
  )
}
