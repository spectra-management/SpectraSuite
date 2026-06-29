import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/shared/lib/supabase'

/** A company activity/event (everyone reads; managers write). */
export interface CompanyEvent {
  id: string
  title: string
  description: string
  /** Event day as YYYY-MM-DD. */
  date: string
  allDay: boolean
}

/** A company birthday (name + month/day only — no year, no sensitive data). */
export interface CompanyBirthday {
  id: string
  name: string
  month: number // 1-12
  day: number   // 1-31
}

interface EventRow {
  id: string
  title: string | null
  description: string | null
  event_date: string | null
  all_day: boolean | null
}

const eventFromRow = (r: EventRow): CompanyEvent => ({
  id: r.id,
  title: r.title ?? '',
  description: r.description ?? '',
  date: (r.event_date ?? '').slice(0, 10),
  allDay: r.all_day ?? true,
})

async function authed(): Promise<boolean> {
  if (!isSupabaseConfigured) return false
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

const uuid = () => crypto.randomUUID()
const ts = () => new Date().toISOString()

interface CalendarState {
  events: CompanyEvent[]
  birthdays: CompanyBirthday[]
  loaded: boolean
  loadAll: () => Promise<void>
  /** Manager-only (RLS-gated). Optimistic + cloud-persisted. */
  createEvent: (input: { title: string; description: string; date: string; allDay: boolean }) => Promise<void>
  updateEvent: (event: CompanyEvent) => Promise<void>
  removeEvent: (id: string) => Promise<void>
}

export const useCompanyCalendarStore = create<CalendarState>((set, get) => ({
  events: [],
  birthdays: [],
  loaded: false,

  loadAll: async () => {
    if (!(await authed())) return
    try {
      const [ev, bd] = await Promise.all([
        supabase.from('company_events').select('*').order('event_date', { ascending: true }),
        supabase.rpc('company_birthdays'),
      ])
      const events = ((ev.data as EventRow[]) ?? []).map(eventFromRow)
      const birthdays = ((bd.data as Array<{ id: string; name: string; birth_month: number; birth_day: number }>) ?? [])
        .filter((r) => r.name && r.birth_month && r.birth_day)
        .map((r) => ({ id: r.id, name: r.name, month: r.birth_month, day: r.birth_day }))
      set({ events, birthdays, loaded: true })
    } catch (e) {
      console.warn('[calendar] loadAll failed:', e)
      set({ loaded: true })
    }
  },

  createEvent: async ({ title, description, date, allDay }) => {
    const event: CompanyEvent = { id: uuid(), title: title.trim(), description: description.trim(), date, allDay }
    set({ events: [...get().events, event].sort((a, b) => a.date.localeCompare(b.date)) })
    try {
      await supabase.from('company_events').insert({
        id: event.id, title: event.title, description: event.description,
        event_date: event.date, all_day: event.allDay, created_at: ts(), updated_at: ts(),
      })
    } catch (e) { console.warn('[calendar] createEvent failed:', e) }
  },

  updateEvent: async (event) => {
    set({ events: get().events.map((e) => (e.id === event.id ? event : e)).sort((a, b) => a.date.localeCompare(b.date)) })
    try {
      await supabase.from('company_events')
        .update({ title: event.title, description: event.description, event_date: event.date, all_day: event.allDay, updated_at: ts() })
        .eq('id', event.id)
    } catch (e) { console.warn('[calendar] updateEvent failed:', e) }
  },

  removeEvent: async (id) => {
    set({ events: get().events.filter((e) => e.id !== id) })
    try { await supabase.from('company_events').delete().eq('id', id) }
    catch (e) { console.warn('[calendar] removeEvent failed:', e) }
  },
}))
