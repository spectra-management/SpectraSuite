import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { generateId } from '@/shared/lib/utils'
import { getDRHolidaysInRange } from './drHolidays'

export interface Holiday {
  id: string
  date: string // YYYY-MM-DD
  name: string
  source: 'auto' | 'manual'
  note?: string
}

// { [country]: { [year]: Holiday[] } }
export type HolidayStore = Record<string, Record<number, Holiday[]>>

// Active countries in the system (one Holidays tab each).
export const HOLIDAY_COUNTRIES = [
  'Dominican Republic',
  'Mexico',
  'United States',
  'Jamaica',
  'Philippines',
  'Kenya',
] as const

// Country name → Nager.Date ISO country code.
export const NAGER_COUNTRY_CODE: Record<string, string> = {
  'Dominican Republic': 'DO',
  Mexico: 'MX',
  'United States': 'US',
  Jamaica: 'JM',
  Philippines: 'PH',
  Kenya: 'KE',
}

// Spanish names for DR statutory holidays — used as a pre-sync fallback so the
// payroll banner is never empty before the first Nager.Date sync.
const DR_HOLIDAY_NAMES: Record<string, string> = {
  newYear: 'Año Nuevo',
  epiphany: 'Día de los Santos Reyes',
  altagracia: 'Día de la Altagracia',
  duarte: 'Día de Duarte',
  independence: 'Día de la Independencia',
  goodFriday: 'Viernes Santo',
  laborDay: 'Día del Trabajo',
  restoration: 'Día de la Restauración',
  mercedes: 'Día de las Mercedes',
  constitution: 'Día de la Constitución',
  christmas: 'Navidad',
}

function loadStore(): HolidayStore {
  return storage.get<HolidayStore>(STORAGE_KEYS.HOLIDAYS) ?? {}
}

function saveStore(store: HolidayStore): void {
  storage.set(STORAGE_KEYS.HOLIDAYS, store)
}

export function getHolidays(country: string, year: number): Holiday[] {
  const list = loadStore()[country]?.[year] ?? []
  return [...list].sort((a, b) => a.date.localeCompare(b.date))
}

export function setHolidays(country: string, year: number, holidays: Holiday[]): void {
  const store = loadStore()
  store[country] = { ...(store[country] ?? {}), [year]: holidays }
  saveStore(store)
}

export function getLastSync(): string | null {
  return storage.get<string>(STORAGE_KEYS.HOLIDAYS_LAST_SYNC)
}

function setLastSync(iso: string): void {
  storage.set(STORAGE_KEYS.HOLIDAYS_LAST_SYNC, iso)
}

/** DR statutory holidays for a year as Holiday[] (fallback before any sync). */
function drFallback(year: number): Holiday[] {
  return getDRHolidaysInRange(`${year}-01-01`, `${year}-12-31`).map((h) => ({
    id: `dr-${h.key}-${year}`,
    date: h.date,
    name: DR_HOLIDAY_NAMES[h.key] ?? h.key,
    source: 'auto' as const,
  }))
}

/**
 * Holidays whose observed date falls within [startDate, endDate] for a country,
 * read from the stored hybrid set. For Dominican Republic, falls back to the
 * computed statutory holidays for any year not yet synced.
 */
export function getHolidaysInRange(country: string, startDate: string, endDate: string): Holiday[] {
  if (!startDate || !endDate) return []
  const startYear = Number(startDate.slice(0, 4))
  const endYear = Number(endDate.slice(0, 4))
  const store = loadStore()
  const out: Holiday[] = []
  for (let y = startYear; y <= endYear; y++) {
    let list = store[country]?.[y]
    if ((!list || list.length === 0) && country === 'Dominican Republic') list = drFallback(y)
    out.push(...(list ?? []))
  }
  return out
    .filter((h) => h.date >= startDate && h.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date))
}

async function fetchNagerHolidays(year: number, countryCode: string): Promise<Holiday[]> {
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`)
  if (!res.ok) throw new Error(`Nager.Date error ${res.status} for ${countryCode} ${year}`)
  const data = (await res.json()) as Array<{ date: string; localName: string; name: string }>
  return data.map((d) => ({
    id: generateId(),
    date: d.date,
    name: d.localName || d.name,
    source: 'auto' as const,
  }))
}

/**
 * Syncs holidays for `year` across the given countries from Nager.Date.
 * Manual holidays are preserved; auto holidays are replaced. Updates last-sync time.
 */
export async function syncHolidays(
  year: number,
  countries: readonly string[] = HOLIDAY_COUNTRIES,
): Promise<{ synced: string[]; failed: string[] }> {
  const results = await Promise.allSettled(
    countries.map(async (country) => {
      const code = NAGER_COUNTRY_CODE[country]
      if (!code) throw new Error(`No Nager code for ${country}`)
      const auto = await fetchNagerHolidays(year, code)
      return { country, auto }
    }),
  )

  const store = loadStore()
  const synced: string[] = []
  const failed: string[] = []

  results.forEach((r, i) => {
    const country = countries[i]
    if (r.status === 'rejected') {
      failed.push(country)
      return
    }
    const { auto } = r.value
    const existing = store[country]?.[year] ?? []
    const manual = existing.filter((h) => h.source === 'manual')
    const manualDates = new Set(manual.map((h) => h.date))
    // Keep all manual entries; add auto entries except where a manual one already owns that date.
    const merged = [...manual, ...auto.filter((h) => !manualDates.has(h.date))]
      .sort((a, b) => a.date.localeCompare(b.date))
    store[country] = { ...(store[country] ?? {}), [year]: merged }
    synced.push(country)
  })

  saveStore(store)
  setLastSync(new Date().toISOString())
  return { synced, failed }
}

/** Adds a manual holiday, returning false if the date already exists for that country/year. */
export function addManualHoliday(
  country: string,
  year: number,
  date: string,
  name: string,
  note?: string,
): boolean {
  const list = getHolidays(country, year)
  if (list.some((h) => h.date === date)) return false
  const holiday: Holiday = { id: generateId(), date, name, source: 'manual', note: note || undefined }
  setHolidays(country, year, [...list, holiday])
  return true
}

/** Updates a holiday (manual or auto) by id. Returns false on duplicate-date conflict. */
export function updateHoliday(
  country: string,
  year: number,
  id: string,
  patch: { date?: string; name?: string; note?: string },
): boolean {
  const list = getHolidays(country, year)
  if (patch.date && list.some((h) => h.date === patch.date && h.id !== id)) return false
  setHolidays(
    country,
    year,
    list.map((h) => (h.id === id ? { ...h, ...patch, note: patch.note ?? h.note } : h)),
  )
  return true
}

export function deleteHoliday(country: string, year: number, id: string): void {
  setHolidays(country, year, getHolidays(country, year).filter((h) => h.id !== id))
}
