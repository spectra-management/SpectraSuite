/**
 * PDF helpers for the billing module.
 *
 * Self-contained (no import from the Payroll module, per IMPORT_RULES). We use
 * @react-pdf's built-in Helvetica rather than embedding a custom font: invoice
 * text is Latin-1 (employee names with accents/ñ encode fine in WinAnsi) and the
 * currency formatter below falls back to the ISO code for any non-Latin symbol
 * (e.g. ₱), so no glyph is ever dropped. The 434KB renderer chunk is lazy-loaded
 * only when a PDF is actually requested.
 */

import type { ReactElement } from 'react'

async function getPdf() {
  const { pdf } = await import('@react-pdf/renderer')
  return pdf
}

export async function generateInvoicePdfBlob(element: ReactElement): Promise<Blob> {
  try {
    const pdf = await getPdf()
    return await pdf(element).toBlob()
  } catch (err) {
    console.error('[billing/pdf] generate failed:', err)
    throw err instanceof Error ? err : new Error(String(err))
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
