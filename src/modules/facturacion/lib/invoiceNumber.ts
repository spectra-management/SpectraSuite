/** MMDDYYYY from an ISO date string (date-only or full). Timezone-safe for `YYYY-MM-DD`. */
function mmddyyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  if (m) return `${m[2]}${m[3]}${m[1]}`
  const d = new Date(iso || Date.now())
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}${dd}${d.getFullYear()}`
}

/**
 * Client invoice number: the client's prefix + the invoice date as MMDDYYYY.
 * e.g. prefix "RM" + 2026-02-16 → "RM02162026". The prefix changes per client.
 */
export function formatInvoiceNumber(prefix: string, issueDateIso: string): string {
  const clean = (prefix || 'INV').trim().toUpperCase()
  return `${clean}${mmddyyyy(issueDateIso)}`
}
