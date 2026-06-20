/**
 * Normalizes a stored company logo into a data URI usable by @react-pdf's <Image>.
 *
 * The logo is saved via FileReader.readAsDataURL (see Settings), so it is already a
 * complete data URI like "data:image/png;base64,..." or "data:image/jpeg;base64,...".
 * The PDF must pass it through AS-IS — prefixing another "data:image/png;base64,"
 * produces invalid data and makes @react-pdf throw ("Failed to generate PDF").
 *
 * Returns undefined when there is no logo or the format can't be rasterized by
 * @react-pdf (SVG), so the caller can simply omit the image instead of crashing.
 */
export function logoSrc(logo?: string): string | undefined {
  if (!logo) return undefined
  // Already a data URI → use as-is. Otherwise assume raw base64 PNG (legacy).
  const uri = logo.startsWith('data:') ? logo : `data:image/png;base64,${logo}`
  // @react-pdf <Image> supports PNG/JPEG only; SVG would throw.
  if (/^data:image\/svg/i.test(uri)) return undefined
  return uri
}
