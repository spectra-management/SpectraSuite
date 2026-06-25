import type { Employee, CompanySettings } from '@/shared/types'
import type { HrEmployeeDetail } from '@/shared/connectors/bamboohr-hr'
import type { FilledVariables } from './types'

/**
 * The catalog of `{{variable}}` keys a template author can insert. Order is the order
 * shown in the "insert variable" helper. Labels/descriptions are translated in the UI
 * via the `documentos.vars.<key>` i18n namespace — the keys themselves are stable data.
 */
export const TEMPLATE_VARIABLES = [
  'nombre',
  'primer_nombre',
  'apellido',
  'cedula',
  'cargo',
  'departamento',
  'salario',
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

  return {
    nombre: `${employee.firstName} ${employee.lastName}`.trim(),
    primer_nombre: employee.firstName,
    apellido: employee.lastName,
    cedula: hr?.nationalId ?? '',
    cargo: employee.jobTitle,
    departamento: employee.department,
    salario: formatMoney(employee.payRate, employee.payRateCurrency),
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
