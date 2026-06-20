/**
 * Generic numeric helpers shared across modules (kept in `shared` so the payroll
 * engine and the shared currency/util formatters can both depend on it without
 * creating a shared → module dependency).
 */

/**
 * Half-up rounding to n decimal places.
 * JavaScript's default rounding can give wrong results for monetary values.
 */
export function roundHalfUp(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Coerces any value to a finite number, returning 0 for null/undefined/NaN/Infinity.
 * Used to guard every numeric that reaches the payroll engine or the PDF renderer
 * (@react-pdf throws "unsupported number: NaN" on a NaN style/measurement).
 */
export function safeNum(val: unknown): number {
  const n = typeof val === 'number' ? val : Number(val)
  return Number.isFinite(n) ? n : 0
}
