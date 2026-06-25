/**
 * Spanish number/date "in words" helpers for legal documents (Dominican Republic).
 *
 * Pure, dependency-free, and unit-tested. Used to render amounts and dates the way the
 * company's official letters/contracts do, e.g.:
 *   - montoEnLetras(270.11)  -> "Doscientos setenta pesos dominicanos con 11/100"
 *   - fechaLegal('2026-06-03') -> "a los tres (03) días del mes de junio del año dos mil veintiséis (2026)"
 */

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve']
const ESPECIALES: Record<number, string> = {
  10: 'diez', 11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince',
  16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve',
  20: 'veinte', 21: 'veintiuno', 22: 'veintidós', 23: 'veintitrés', 24: 'veinticuatro',
  25: 'veinticinco', 26: 'veintiséis', 27: 'veintisiete', 28: 'veintiocho', 29: 'veintinueve',
}
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos']

function dosCifras(n: number): string {
  if (n < 10) return UNIDADES[n]
  if (ESPECIALES[n]) return ESPECIALES[n]
  const d = Math.floor(n / 10)
  const u = n % 10
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} y ${UNIDADES[u]}`
}

function tresCifras(n: number): string {
  if (n === 100) return 'cien'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const cen = CENTENAS[c]
  if (resto === 0) return cen
  return cen ? `${cen} ${dosCifras(resto)}` : dosCifras(resto)
}

/**
 * Integer to Spanish words (0 .. 999,999,999). Lowercase, no leading/trailing spaces.
 * "uno" stays "uno" (caller decides apocope to "un" if needed — not required here).
 */
export function numeroALetras(num: number): string {
  const n = Math.floor(Math.abs(num))
  if (n === 0) return 'cero'

  const millones = Math.floor(n / 1_000_000)
  const miles = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000

  const parts: string[] = []

  if (millones > 0) {
    parts.push(millones === 1 ? 'un millón' : `${numeroALetras(millones)} millones`)
  }
  if (miles > 0) {
    parts.push(miles === 1 ? 'mil' : `${tresCifras(miles)} mil`)
  }
  if (resto > 0) {
    parts.push(tresCifras(resto))
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

function capitalizeFirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Money amount in the legal style used by the company:
 *   270.11 -> "Doscientos setenta pesos dominicanos con 11/100"
 * The integer part is spelled out (first letter capitalized); cents are kept as NN/100.
 */
export function montoEnLetras(amount: number, currencyWord = 'pesos dominicanos'): string {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0
  const entero = Math.floor(safe)
  const centavos = Math.round((safe - entero) * 100)
  const cc = String(centavos).padStart(2, '0')
  return `${capitalizeFirst(numeroALetras(entero))} ${currencyWord} con ${cc}/100`
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

/**
 * Legal date phrase: "a los tres (03) días del mes de junio del año dos mil veintiséis (2026)".
 * Accepts a YYYY-MM-DD string. Returns "" for empty/invalid input.
 */
export function fechaLegal(dateStr: string): string {
  if (!dateStr) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr)
  if (!m) return ''
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  const dd = String(day).padStart(2, '0')
  const mes = MESES[month - 1]
  const anio = `${numeroALetras(year)} (${year})`
  if (day === 1) {
    return `al primer (01) día del mes de ${mes} del año ${anio}`
  }
  return `a los ${numeroALetras(day)} (${dd}) días del mes de ${mes} del año ${anio}`
}
