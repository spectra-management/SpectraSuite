import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Kanban, Plus, Trash2, Pencil, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/components/ui/dialog'
import { useBoardStore } from '../store/boardStore'

export function BoardsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const boards = useBoardStore((s) => s.boards)
  const loading = useBoardStore((s) => s.loadingBoards)
  const loadBoards = useBoardStore((s) => s.loadBoards)
  const createBoard = useBoardStore((s) => s.createBoard)
  const renameBoard = useBoardStore((s) => s.renameBoard)
  const removeBoard = useBoardStore((s) => s.removeBoard)

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    void loadBoards()
  }, [loadBoards])

  const submitCreate = async () => {
    const name = newName.trim()
    if (!name) return
    const board = await createBoard(name)
    setNewName('')
    setCreating(false)
    navigate(`/tablero/boards/${board.id}`)
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('tablero.boards.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('tablero.boards.subtitle')}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          {t('tablero.boards.new')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
          <Kanban className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{t('tablero.boards.emptyTitle')}</p>
          <p className="mb-4 text-sm text-muted-foreground">{t('tablero.boards.emptyHint')}</p>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            {t('tablero.boards.new')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boards.map((b) => (
            <div
              key={b.id}
              className="group relative flex h-32 cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-emerald-300 hover:shadow-md"
              onClick={() => navigate(`/tablero/boards/${b.id}`)}
            >
              <span className="absolute left-0 top-0 h-1 w-full bg-ink-grad" />
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                  <Kanban className="h-4.5 w-4.5" />
                </span>
                <p className="line-clamp-2 pt-1 text-sm font-semibold text-foreground">{b.name}</p>
              </div>
              <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  aria-label={t('common.edit')}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); setEditing({ id: b.id, name: b.name }) }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={t('common.delete')}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                  onClick={(e) => { e.stopPropagation(); setDeleting({ id: b.id, name: b.name }) }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create */}
      <Dialog open={creating} onOpenChange={(o) => { if (!o) { setCreating(false); setNewName('') } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('tablero.boards.new')}</DialogTitle></DialogHeader>
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void submitCreate() }}
            placeholder={t('tablero.boards.namePlaceholder')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setNewName('') }}>{t('common.cancel')}</Button>
            <Button onClick={() => void submitCreate()} disabled={!newName.trim()}>{t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('tablero.boards.rename')}</DialogTitle></DialogHeader>
          <Input
            autoFocus
            value={editing?.name ?? ''}
            onChange={(e) => setEditing((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && editing && editing.name.trim()) {
                renameBoard(editing.id, editing.name.trim()); setEditing(null)
              }
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t('common.cancel')}</Button>
            <Button
              onClick={() => { if (editing && editing.name.trim()) { renameBoard(editing.id, editing.name.trim()); setEditing(null) } }}
              disabled={!editing?.name.trim()}
            >
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('tablero.boards.deleteTitle')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('tablero.boards.deleteConfirm', { name: deleting?.name })}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => { if (deleting) { removeBoard(deleting.id); setDeleting(null) } }}>
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
