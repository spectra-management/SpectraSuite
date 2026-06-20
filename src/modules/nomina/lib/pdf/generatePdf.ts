import type { ReactElement } from 'react'

let fontsRegistered = false

/**
 * Registers an embedded Unicode font (Roboto) so the PDF renders the full Latin set —
 * accents/ñ (e.g. "Idaly Peña"), accented company names, and currency symbols like ₱/₡ —
 * which the built-in Helvetica (WinAnsi) cannot encode.
 *
 * The font bytes are inlined as base64 data URIs (see robotoFont.ts) instead of fetched
 * from /fonts/*.ttf, so PDF generation has NO runtime asset dependency. A missing/blocked
 * font file used to make the whole render throw ("Failed to generate PDF").
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function registerFonts(Font: any): Promise<void> {
  if (fontsRegistered) return
  const { ROBOTO_REGULAR, ROBOTO_BOLD } = await import('./robotoFont')
  Font.register({
    family: 'Roboto',
    fonts: [
      { src: ROBOTO_REGULAR, fontWeight: 'normal' },
      { src: ROBOTO_BOLD, fontWeight: 'bold' },
    ],
  })
  // Keep words intact (no automatic hyphenation of names/amounts).
  Font.registerHyphenationCallback((word: string) => [word])
  fontsRegistered = true
}

/**
 * Lazily imports @react-pdf/renderer so the 434KB chunk is only loaded
 * when the user actually requests a PDF, not on initial page load.
 */
async function getPdfRenderer() {
  const { pdf, Font } = await import('@react-pdf/renderer')
  await registerFonts(Font)
  return { pdf }
}

export async function generatePdfBlob(element: ReactElement): Promise<Blob> {
  try {
    const { pdf } = await getPdfRenderer()
    return await pdf(element).toBlob()
  } catch (err) {
    // Surface the real exception (font load, image decode, etc.) instead of hiding it.
    console.error('[PDF] generatePdfBlob failed:', err)
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

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
