/** Documentos country-scoping helpers. */

/** A template applies to the selected country when it has no country (all) or matches it. */
export function templateInCountry(templateCountry: string | undefined, country: string): boolean {
  return !templateCountry || templateCountry === country
}
