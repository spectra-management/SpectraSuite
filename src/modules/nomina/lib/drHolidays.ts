export interface DRHoliday {
  date: string         // YYYY-MM-DD observed (after Monday transfer if applicable)
  canonicalDate: string // YYYY-MM-DD original calendar date
  key: string          // i18n key under payroll.holidays.*
  movable: boolean     // true when DR law transfers this to nearest Monday
}

// RD Law 139-97: movable holidays are transferred to the nearest Monday.
// Nearest Monday rule: Tue/Wed/Thu → previous Monday; Fri/Sat/Sun → next Monday.
function nearestMonday(d: Date): Date {
  const day = d.getDay() // 0=Sun … 6=Sat
  if (day === 1) return d                         // already Monday
  const offsets = [1, 0, -1, -2, 4, 3, 2]       // Sun Mon Tue Wed Thu Fri Sat
  const result = new Date(d)
  result.setDate(d.getDate() + offsets[day])
  return result
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function fixed(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

// Anonymous Gregorian algorithm (Oudin, 1940)
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function goodFriday(year: number): Date {
  const easter = easterSunday(year)
  const gf = new Date(easter)
  gf.setDate(easter.getDate() - 2)
  return gf
}

function holidaysForYear(year: number): DRHoliday[] {
  const mkFixed = (month: number, day: number, key: string): DRHoliday => {
    const canonical = fixed(year, month, day)
    return { date: ymd(canonical), canonicalDate: ymd(canonical), key, movable: false }
  }

  const mkMovable = (month: number, day: number, key: string): DRHoliday => {
    const canonical = fixed(year, month, day)
    const observed = nearestMonday(canonical)
    return { date: ymd(observed), canonicalDate: ymd(canonical), key, movable: true }
  }

  const gf = goodFriday(year)

  return [
    mkFixed(1, 1,   'newYear'),
    mkMovable(1, 6,  'epiphany'),
    mkFixed(1, 21,  'altagracia'),
    mkMovable(1, 26, 'duarte'),
    mkFixed(2, 27,  'independence'),
    { date: ymd(gf), canonicalDate: ymd(gf), key: 'goodFriday', movable: false },
    mkMovable(5, 1,  'laborDay'),
    mkMovable(8, 16, 'restoration'),
    mkFixed(9, 24,  'mercedes'),
    mkMovable(11, 6, 'constitution'),
    mkFixed(12, 25, 'christmas'),
  ]
}

export function getDRHolidaysInRange(startDate: string, endDate: string): DRHoliday[] {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  const all: DRHoliday[] = []
  for (let y = startYear; y <= endYear; y++) {
    all.push(...holidaysForYear(y))
  }

  return all.filter((h) => h.date >= startDate && h.date <= endDate)
}
