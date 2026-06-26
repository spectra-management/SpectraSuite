/**
 * Employee "baseball card" model + resolution.
 *
 * The card is auto-filled from HR data, but EVERY field may be overridden by hand (some
 * fields — job history, hobbies, fun facts, goals, leadership style, education, account —
 * have no HR source at all and are manual-only). `resolveBaseballCard` merges the stored
 * overrides over the HR-derived values: a non-empty override always wins; otherwise the HR
 * value (formatted) is used.
 *
 * Module-agnostic on purpose (lives in @/shared): the RRHH tab maps its RrhhEmployee into the
 * small `HrCardSource` shape, so this file never depends on a module's types.
 */

/** Stored, per-employee manual overrides. Any field absent/empty falls back to HR. */
export interface BaseballCardOverrides {
  fullName?: string
  nickName?: string
  /** Birthday as month + day only (privacy: no year), e.g. "January 27". */
  dobMonthDay?: string
  /** Spectra start as month + year, e.g. "Aug 2023". */
  spectraStartDate?: string
  accountName?: string
  accountStartDate?: string
  jobTitle?: string
  jobHistory?: string[]
  education?: string
  hobbies?: string[]
  funFacts?: string[]
  leadershipStyle?: string
  goals?: string[]
}

/** The few HR fields the card derives auto-values from. */
export interface HrCardSource {
  fullName: string
  nickName: string
  /** ISO date (YYYY-MM-DD) or ''. */
  dateOfBirth: string
  /** ISO date (YYYY-MM-DD) or ''. */
  hireDate: string
  jobTitle: string
}

/** Fully-resolved card ready to render (every field a concrete string / list). */
export interface ResolvedBaseballCard {
  fullName: string
  nickName: string
  dobMonthDay: string
  spectraStartDate: string
  accountName: string
  accountStartDate: string
  jobTitle: string
  jobHistory: string[]
  education: string
  hobbies: string[]
  funFacts: string[]
  leadershipStyle: string
  goals: string[]
}

/** Parse a YYYY-MM-DD string to a local Date, or null if invalid. */
function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim())
  if (!m) return null
  const [, y, mo, d] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d))
  return Number.isNaN(date.getTime()) ? null : date
}

/** "January 27" (privacy: month + day, no year). '' when the date is missing/invalid. */
export function formatMonthDay(iso: string, lang: string): string {
  const date = parseIsoDate(iso)
  if (!date) return ''
  return new Intl.DateTimeFormat(lang, { month: 'long', day: 'numeric' }).format(date)
}

/** "Aug 2023" (month abbreviation + year). '' when the date is missing/invalid. */
export function formatMonthYear(iso: string, lang: string): string {
  const date = parseIsoDate(iso)
  if (!date) return ''
  return new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric' }).format(date)
}

const pick = (override: string | undefined, auto: string): string => {
  const o = (override ?? '').trim()
  return o || auto
}

const list = (arr: string[] | undefined): string[] =>
  (arr ?? []).map((s) => s.trim()).filter(Boolean)

/** Merge stored overrides over the HR-derived values into a ready-to-render card. */
export function resolveBaseballCard(
  hr: HrCardSource,
  ov: BaseballCardOverrides,
  lang: string,
): ResolvedBaseballCard {
  return {
    fullName: pick(ov.fullName, hr.fullName),
    nickName: pick(ov.nickName, hr.nickName),
    dobMonthDay: pick(ov.dobMonthDay, formatMonthDay(hr.dateOfBirth, lang)),
    spectraStartDate: pick(ov.spectraStartDate, formatMonthYear(hr.hireDate, lang)),
    accountName: (ov.accountName ?? '').trim(),
    accountStartDate: (ov.accountStartDate ?? '').trim(),
    jobTitle: pick(ov.jobTitle, hr.jobTitle),
    jobHistory: list(ov.jobHistory),
    education: (ov.education ?? '').trim(),
    hobbies: list(ov.hobbies),
    funFacts: list(ov.funFacts),
    leadershipStyle: (ov.leadershipStyle ?? '').trim(),
    goals: list(ov.goals),
  }
}
