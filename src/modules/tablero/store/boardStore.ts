import { create } from 'zustand'
import type { Board, BoardList, BoardCard } from '../lib/types'
import {
  fetchBoards, fetchBoardData, upsertBoard, deleteBoardApi,
  upsertList, deleteListApi, upsertCard, deleteCardApi,
} from '../lib/api'

const uuid = () => crypto.randomUUID()

interface BoardState {
  boards: Board[]
  loadingBoards: boolean
  // Currently open board:
  currentId: string | null
  lists: BoardList[]
  cards: BoardCard[]
  loadingBoard: boolean

  loadBoards: () => Promise<void>
  createBoard: (name: string) => Promise<Board>
  renameBoard: (id: string, name: string) => void
  removeBoard: (id: string) => void

  openBoard: (id: string) => Promise<void>
  addList: (name: string) => void
  renameList: (id: string, name: string) => void
  removeList: (id: string) => void

  addCard: (listId: string, title: string) => void
  updateCard: (card: BoardCard) => void
  removeCard: (id: string) => void
  /** Move a card to a list, before `beforeCardId` (null = append). */
  moveCard: (cardId: string, toListId: string, beforeCardId: string | null) => void
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boards: [],
  loadingBoards: false,
  currentId: null,
  lists: [],
  cards: [],
  loadingBoard: false,

  loadBoards: async () => {
    set({ loadingBoards: true })
    const boards = await fetchBoards()
    set({ boards, loadingBoards: false })
  },

  createBoard: async (name) => {
    const board: Board = {
      id: uuid(), name: name.trim() || 'Board',
      position: get().boards.length, archived: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    set({ boards: [...get().boards, board] })
    await upsertBoard(board)
    return board
  },

  renameBoard: (id, name) => {
    const boards = get().boards.map((b) => (b.id === id ? { ...b, name } : b))
    set({ boards })
    const b = boards.find((x) => x.id === id)
    if (b) void upsertBoard(b)
  },

  removeBoard: (id) => {
    set({ boards: get().boards.filter((b) => b.id !== id) })
    void deleteBoardApi(id)
  },

  openBoard: async (id) => {
    set({ currentId: id, loadingBoard: true, lists: [], cards: [] })
    const { lists, cards } = await fetchBoardData(id)
    set({ lists, cards, loadingBoard: false })
  },

  addList: (name) => {
    const boardId = get().currentId
    if (!boardId) return
    const list: BoardList = { id: uuid(), boardId, name: name.trim() || 'List', position: get().lists.length }
    set({ lists: [...get().lists, list] })
    void upsertList(list)
  },

  renameList: (id, name) => {
    const lists = get().lists.map((l) => (l.id === id ? { ...l, name } : l))
    set({ lists })
    const l = lists.find((x) => x.id === id)
    if (l) void upsertList(l)
  },

  removeList: (id) => {
    set({ lists: get().lists.filter((l) => l.id !== id), cards: get().cards.filter((c) => c.listId !== id) })
    void deleteListApi(id) // cascade deletes its cards in the DB
  },

  addCard: (listId, title) => {
    const boardId = get().currentId
    if (!boardId) return
    const inList = get().cards.filter((c) => c.listId === listId)
    const maxPos = inList.reduce((m, c) => Math.max(m, c.position), 0)
    const card: BoardCard = {
      id: uuid(), boardId, listId, title: title.trim(), description: '', assignee: '', dueDate: '',
      labels: [], checklist: [], comments: [], position: maxPos + 1,
    }
    set({ cards: [...get().cards, card] })
    void upsertCard(card)
  },

  updateCard: (card) => {
    set({ cards: get().cards.map((c) => (c.id === card.id ? card : c)) })
    void upsertCard(card)
  },

  removeCard: (id) => {
    set({ cards: get().cards.filter((c) => c.id !== id) })
    void deleteCardApi(id)
  },

  moveCard: (cardId, toListId, beforeCardId) => {
    const card = get().cards.find((c) => c.id === cardId)
    if (!card) return
    // Target list cards (sorted), excluding the one being moved.
    const target = get().cards
      .filter((c) => c.listId === toListId && c.id !== cardId)
      .sort((a, b) => a.position - b.position)
    const idx = beforeCardId ? target.findIndex((c) => c.id === beforeCardId) : target.length
    const prev = idx > 0 ? target[idx - 1].position : null
    const next = idx >= 0 && idx < target.length ? target[idx].position : null
    let position: number
    if (prev == null && next == null) position = 0
    else if (prev == null) position = (next as number) - 1
    else if (next == null) position = prev + 1
    else position = (prev + next) / 2
    const moved: BoardCard = { ...card, listId: toListId, position }
    set({ cards: get().cards.map((c) => (c.id === cardId ? moved : c)) })
    void upsertCard(moved)
  },
}))
