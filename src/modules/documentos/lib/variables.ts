import type { Employee, CompanySettings } from '@/shared/types'
import type { HrEmployeeDetail } from '@/shared/connectors/bamboohr-hr'
import { roundHalfUp } from '@/shared/lib/number'
import type { FilledVariables } from './types'
import { montoEnLetras, fechaLegal } from './spanishWords'

// Standard full-time month: 40 h/week x 52 weeks / 12 months = 173.3333 h. Used to derive a
// monthly figure from an hourly rate (matches the company's letters, e.g. 270.11 -> 46,819.07).
const MONTHLY_HOURS = (40 * 52) / 12

/**
 * The catalog of `{{variable}}` keys a template author can insert. Order is the order
 * shown in the "insert variable" helper. Labels/descriptions are translated in the UI
 * via the `documentos.vars.<key>` i18n namespace — the keys themselves are stable data.
 */
export const TEMPLATE_VARIABLES = [
  'nombre',
  'trato',
  'primer_nombre',
  'apellido',
  'cedula',
  'cargo',
  'departamento',
  'salario',
  'salario_hora',
  'salario_mensual',
  'salario_letras',
  'fecha_ingreso',
  'email',
  'telefono',
  'direccion',
  'fecha_nacimiento',
  'nacionalidad',
  'supervisor',
  'pais',
  'empresa',
  'empresa_rnc',
  'empresa_direccion',
  'empresa_telefono',
  'fecha_hoy',
  'fecha_legal',
] as const

export type TemplateVariableKey = (typeof TEMPLATE_VARIABLES)[number]

/** Localized long date, e.g. "25 de junio de 2026" / "June 25, 2026". Empty in → "". */
export function formatLongDate(dateStr: string, lang: string): string {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  const locale = lang.startsWith('es') ? 'es-DO' : 'en-US'
  return d.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatMoney(amount: number, currency?: string): string {
  // payRate === 0 means "not set in BambooHR" (pairs with an empty payRateCurrency),
  // so we render it as blank rather than "0.00" — the document just omits the figure.
  if (!amount) return ''
  const n = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? `${currency} ${n}` : n
}

/** Plain grouped figure, no currency symbol: 46819.07 -> "46,819.07". 0 -> "". */
function formatFigure(amount: number): string {
  if (!amount) return ''
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Gendered salutation from the HR sex field: "la señora" / "el señor" / "el/la señor(a)". */
function salutation(gender?: string): string {
  const g = (gender ?? '').trim().toLowerCase()
  if (g.startsWith('f')) return 'la señora'        // Female / Femenino
  if (g.startsWith('m')) return 'el señor'         // Male / Masculino
  return 'el/la señor(a)'
}

/** Monthly figure: hourly rate x standard month for Hourly staff; the rate itself for Salary. */
function monthlySalary(employee: Employee): number {
  if (!employee.payRate) return 0
  return employee.payType === 'Salary'
    ? employee.payRate
    : roundHalfUp(employee.payRate * MONTHLY_HOURS, 2)
}

/**
 * Resolves every template variable for one employee from the shared Employee record,
 * the (optional) rich HR detail, and company settings. Missing values resolve to "".
 */
export function buildVariables(
  employee: Employee,
  hr: HrEmployeeDetail | undefined,
  company: CompanySettings,
  lang: string,
  now: Date,
): FilledVariables {
  const fullAddress = [hr?.address, hr?.city, hr?.state].map((s) => (s ?? '').trim()).filter(Boolean).join(', ')
  const phone = (hr?.mobilePhone || hr?.workPhone || hr?.homePhone || '').trim()
  const todayStr = now.toISOString().slice(0, 10)
  const monthly = monthlySalary(employee)

  return {
    nombre: `${employee.firstName} ${employee.lastName}`.trim(),
    trato: salutation(hr?.gender),
    primer_nombre: employee.firstName,
    apellido: employee.lastName,
    cedula: hr?.nationalId ?? '',
    cargo: employee.jobTitle,
    departamento: employee.department,
    salario: formatMoney(employee.payRate, employee.payRateCurrency),
    salario_hora: formatFigure(employee.payRate),
    salario_mensual: formatFigure(monthly),
    salario_letras: employee.payRate ? montoEnLetras(employee.payRate) : '',
    fecha_ingreso: formatLongDate(employee.hireDate, lang),
    email: employee.workEmail,
    telefono: phone,
    direccion: fullAddress,
    fecha_nacimiento: formatLongDate(hr?.dateOfBirth ?? '', lang),
    nacionalidad: hr?.nationality ?? '',
    supervisor: hr?.supervisor ?? '',
    pais: employee.country ?? '',
    empresa: company.name,
    empresa_rnc: company.rnc,
    empresa_direccion: company.address,
    empresa_telefono: company.phone,
    fecha_hoy: formatLongDate(todayStr, lang),
    fecha_legal: fechaLegal(todayStr),
  }
}

// Matches {{ key }} with optional surrounding whitespace; key is letters/digits/underscore.
const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/**
 * Replaces every `{{key}}` in `text` with its value from `vars`. Known catalog keys
 * with no value resolve to "" (the data simply isn't set). UNKNOWN keys are left
 * verbatim so authors can spot typos like `{{nmbre}}`.
 */
export function fillTemplate(text: string, vars: FilledVariables): string {
  const known = new Set<string>(TEMPLATE_VARIABLES)
  return text.replace(TOKEN_RE, (match, key: string) => {
    if (key in vars) return vars[key]
    if (known.has(key)) return ''
    return match
  })
}

/** Lists the distinct variable keys referenced by a template (for preview / validation). */
export function extractUsedVariables(text: string): string[] {
  const out = new Set<string>()
  let m: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(text)) !== null) out.add(m[1])
  return [...out]
}
