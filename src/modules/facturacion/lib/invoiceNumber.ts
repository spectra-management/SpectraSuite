/** Format a client invoice number, e.g. prefix "RM" + seq 1 → "RM-0001". */
export function formatInvoiceNumber(prefix: string, seq: number): string {
  const clean = (prefix || 'INV').trim().toUpperCase()
  return `${clean}-${String(seq).padStart(4, '0')}`
}
