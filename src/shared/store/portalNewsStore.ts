import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/shared/lib/supabase'

/** A single portal news / announcement item. */
export interface NewsItem {
  id: string
  title: string
  body: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

interface NewsRow {
  id: string
  title: string | null
  body: string | null
  pinned: boolean | null
  created_at: string | null
  updated_at: string | null
}

const fromRow = (r: NewsRow): NewsItem => ({
  id: r.id,
  title: r.title ?? '',
  body: r.body ?? '',
  pinned: !!r.pinned,
  createdAt: r.created_at ?? '',
  updatedAt: r.updated_at ?? '',
})

/** Pinned first, then newest. */
const sortNews = (a: NewsItem, b: NewsItem): number =>
  a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.createdAt.localeCompare(a.createdAt)

async function authed(): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

const uuid = () => crypto.randomUUID()
const ts = () => new Date().toISOString()

interface NewsState {
  items: NewsItem[]
  loading: boolean
  load: () => Promise<void>
  /** Manager-only (RLS-gated). Optimistic + cloud-persisted. */
  create: (input: { title: string; body: string; pinned: boolean }) => Promise<void>
  update: (item: NewsItem) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const usePortalNewsStore = create<NewsState>((set, get) => ({
  items: [],
  loading: false,

  load: async () => {
    if (!(await authed())) return
    set({ loading: true })
    try {
      const { data, error } = await supabase.from('portal_news').select('*')
      if (!error && data) set({ items: (data as NewsRow[]).map(fromRow).sort(sortNews) })
    } catch (e) {
      console.warn('[portal-news] load failed:', e)
    } finally {
      set({ loading: false })
    }
  },

  create: async ({ title, body, pinned }) => {
    const item: NewsItem = { id: uuid(), title: title.trim(), body: body.trim(), pinned, createdAt: ts(), updatedAt: ts() }
    set({ items: [item, ...get().items].sort(sortNews) })
    try {
      await supabase.from('portal_news').insert({
        id: item.id, title: item.title, body: item.body, pinned: item.pinned,
        created_at: item.createdAt, updated_at: item.updatedAt,
      })
    } catch (e) { console.warn('[portal-news] create failed:', e) }
  },

  update: async (item) => {
    const next = { ...item, updatedAt: ts() }
    set({ items: get().items.map((n) => (n.id === item.id ? next : n)).sort(sortNews) })
    try {
      await supabase.from('portal_news')
        .update({ title: next.title, body: next.body, pinned: next.pinned, updated_at: next.updatedAt })
        .eq('id', item.id)
    } catch (e) { console.warn('[portal-news] update failed:', e) }
  },

  remove: async (id) => {
    set({ items: get().items.filter((n) => n.id !== id) })
    try { await supabase.from('portal_news').delete().eq('id', id) }
    catch (e) { console.warn('[portal-news] remove failed:', e) }
  },
}))
