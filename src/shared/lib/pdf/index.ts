/**
 * Shared PDF helpers — feature-agnostic, reusable by any module.
 *
 * Uses @react-pdf's built-in Helvetica (WinAnsi) rather than embedding a custom font:
 * Spanish document text (accents, ñ, ¿, ¡) encodes fine in Latin-1, so no glyph is
 * dropped and we avoid shipping a ~440KB embedded font. The 434KB renderer chunk is
 * lazy-loaded only when a PDF is actually requested.
 *
 * (The Nómina module keeps its own Roboto-embedded generator for currency glyphs like
 * ₱/₡ in paystubs; documents don't need those.)
 */
import type { ReactElement } from 'react'

async function getPdf() {
  const { pdf } = await import('@react-pdf/renderer')
  return pdf
}

export async function generatePdfBlob(element: ReactElement): Promise<Blob> {
  try {
    const pdf = await getPdf()
    return await pdf(element).toBlob()
  } catch (err) {
    console.error('[shared/pdf] generatePdfBlob failed:', err)
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
