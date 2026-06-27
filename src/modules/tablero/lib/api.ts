/**
 * Tablero data access — direct Supabase CRUD (admin/manager-only via RLS, migration 016).
 * Best-effort + offline-safe: failures log and return empty/no-op so the UI keeps working.
 */
import { supabase, isSupabaseConfigured } from '@/shared/lib/supabase'
import type { Board, BoardList, BoardCard, ChecklistItem, CardComment } from './types'

async function authed(): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

interface BoardRow { id: string; name: string | null; position: number | null; archived: boolean | null; created_at: string | null; updated_at: string | null }
interface ListRow { id: string; board_id: string; name: string | null; position: number | null }
interface CardRow {
  id: string; board_id: string; list_id: string; title: string | null; description: string | null
  assignee: string | null; due_date: string | null; labels: string[] | null
  checklist: ChecklistItem[] | null; comments: CardComment[] | null; position: number | null
}

const boardFromRow = (r: BoardRow): Board => ({
  id: r.id, name: r.name ?? '', position: Number(r.position ?? 0), archived: !!r.archived,
  createdAt: r.created_at ?? '', updatedAt: r.updated_at ?? '',
})
const listFromRow = (r: ListRow): BoardList => ({ id: r.id, boardId: r.board_id, name: r.name ?? '', position: Number(r.position ?? 0) })
const cardFromRow = (r: CardRow): BoardCard => ({
  id: r.id, boardId: r.board_id, listId: r.list_id, title: r.title ?? '', description: r.description ?? '',
  assignee: r.assignee ?? '', dueDate: r.due_date ?? '', labels: r.labels ?? [],
  checklist: r.checklist ?? [], comments: r.comments ?? [], position: Number(r.position ?? 0),
})

export async function fetchBoards(): Promise<Board[]> {
  if (!(await authed())) return []
  try {
    const { data, error } = await supabase.from('tablero_boards').select('*').eq('archived', false).order('position', { ascending: true })
    if (error || !data) return []
    return (data as BoardRow[]).map(boardFromRow)
  } catch (e) { console.warn('[tablero] fetchBoards failed:', e); return [] }
}

export async function fetchBoardData(boardId: string): Promise<{ lists: BoardList[]; cards: BoardCard[] }> {
  if (!(await authed())) return { lists: [], cards: [] }
  try {
    const [l, c] = await Promise.all([
      supabase.from('tablero_lists').select('*').eq('board_id', boardId).order('position', { ascending: true }),
      supabase.from('tablero_cards').select('*').eq('board_id', boardId).order('position', { ascending: true }),
    ])
    return {
      lists: ((l.data as ListRow[]) ?? []).map(listFromRow),
      cards: ((c.data as CardRow[]) ?? []).map(cardFromRow),
    }
  } catch (e) { console.warn('[tablero] fetchBoardData failed:', e); return { lists: [], cards: [] } }
}

const ts = () => new Date().toISOString()

export async function upsertBoard(b: Board): Promise<void> {
  if (!(await authed())) return
  try { await supabase.from('tablero_boards').upsert({ id: b.id, name: b.name, position: b.position, archived: b.archived, updated_at: ts() }, { onConflict: 'id' }) }
  catch (e) { console.warn('[tablero] upsertBoard failed:', e) }
}
export async function deleteBoardApi(id: string): Promise<void> {
  if (!(await authed())) return
  try { await supabase.from('tablero_boards').delete().eq('id', id) } catch (e) { console.warn('[tablero] deleteBoard failed:', e) }
}

export async function upsertList(l: BoardList): Promise<void> {
  if (!(await authed())) return
  try { await supabase.from('tablero_lists').upsert({ id: l.id, board_id: l.boardId, name: l.name, position: l.position, updated_at: ts() }, { onConflict: 'id' }) }
  catch (e) { console.warn('[tablero] upsertList failed:', e) }
}
export async function deleteListApi(id: string): Promise<void> {
  if (!(await authed())) return
  try { await supabase.from('tablero_lists').delete().eq('id', id) } catch (e) { console.warn('[tablero] deleteList failed:', e) }
}

export async function upsertCard(c: BoardCard): Promise<void> {
  if (!(await authed())) return
  try {
    await supabase.from('tablero_cards').upsert({
      id: c.id, board_id: c.boardId, list_id: c.listId, title: c.title, description: c.description,
      assignee: c.assignee, due_date: c.dueDate, labels: c.labels, checklist: c.checklist, comments: c.comments,
      position: c.position, updated_at: ts(),
    }, { onConflict: 'id' })
  } catch (e) { console.warn('[tablero] upsertCard failed:', e) }
}
export async function deleteCardApi(id: string): Promise<void> {
  if (!(await authed())) return
  try { await supabase.from('tablero_cards').delete().eq('id', id) } catch (e) { console.warn('[tablero] deleteCard failed:', e) }
}
