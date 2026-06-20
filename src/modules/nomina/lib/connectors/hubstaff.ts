import type { HubstaffMember, HubstaffActivityUser, WeeklyHours } from './types'
export type { HubstaffActivityUser }
import { roundHalfUp } from '@/modules/nomina/lib/payroll/calculations'

const ACCESS_TOKEN_MARGIN_MS = 5 * 60 * 1000  // skip exchange if token expires within 5 min

/**
 * Canonical email for matching: trim + lowercase. Emails frequently differ in casing
 * (and occasionally whitespace) between BambooHR and Hubstaff, so always compare via this.
 */
export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

export interface HubstaffTokenState {
  refreshToken: string
  cachedAccessToken?: string
  cachedAccessTokenExpiry?: number
}

export interface HubstaffTokenUpdate {
  newRefreshToken: string | null
  newAccessToken: string | null
  newAccessTokenExpiry: number | null
}

function buildUrl(endpoint: string, extra?: Record<string, string>): string {
  // Build manually so bracket-keyed params (e.g. date[start]) are NOT percent-encoded.
  // Hubstaff v2 requires literal brackets in query param names.
  const base = `/api/hubstaff?endpoint=${encodeURIComponent(endpoint)}`
  if (!extra) return base
  const parts = Object.entries(extra).map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
  return parts.length > 0 ? `${base}&${parts.join('&')}` : base
}

async function fetchHubstaff(
  endpoint: string,
  tokenState: HubstaffTokenState,
  extra?: Record<string, string>,
): Promise<{ res: Response; tokenUpdate: HubstaffTokenUpdate }> {
  const url = buildUrl(endpoint, extra)

  const now = Date.now()
  const useCached =
    !!tokenState.cachedAccessToken &&
    !!tokenState.cachedAccessTokenExpiry &&
    now < tokenState.cachedAccessTokenExpiry - ACCESS_TOKEN_MARGIN_MS

  const headers: Record<string, string> = { 'Accept': 'application/json' }
  if (useCached) {
    headers['x-hubstaff-access-token'] = tokenState.cachedAccessToken!
  } else {
    headers['x-hubstaff-refresh-token'] = tokenState.refreshToken
  }

  const res = await fetch(url, { method: 'GET', headers })

  const expiryHeader = res.headers.get('x-access-token-expiry')
  const tokenUpdate: HubstaffTokenUpdate = {
    newRefreshToken: res.headers.get('x-new-refresh-token'),
    newAccessToken: res.headers.get('x-new-access-token'),
    newAccessTokenExpiry: expiryHeader ? Number(expiryHeader) : null,
  }

  return { res, tokenUpdate }
}

export interface HubstaffOrganization {
  id: number
  name: string
}

/**
 * Validates the refresh token by calling users/me then listing organizations.
 * Returns organizations and a token update that must be saved by the caller.
 */
export async function testHubstaffToken(tokenState: HubstaffTokenState): Promise<{
  organizations: HubstaffOrganization[]
  tokenUpdate: HubstaffTokenUpdate
}> {
  // Call users/me first to confirm auth
  const { res: meRes, tokenUpdate } = await fetchHubstaff('users/me', tokenState)
  if (!meRes.ok) {
    const err = await meRes.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(err.error ?? `Hubstaff error ${meRes.status}`)
  }

  // Use the fresh access token for the second call — avoids a second exchange
  const updatedState: HubstaffTokenState = {
    refreshToken: tokenUpdate.newRefreshToken ?? tokenState.refreshToken,
    cachedAccessToken: tokenUpdate.newAccessToken ?? tokenState.cachedAccessToken,
    cachedAccessTokenExpiry: tokenUpdate.newAccessTokenExpiry ?? tokenState.cachedAccessTokenExpiry,
  }

  const { res: orgsRes, tokenUpdate: orgsUpdate } = await fetchHubstaff('organizations', updatedState)
  const finalUpdate: HubstaffTokenUpdate = {
    newRefreshToken: orgsUpdate.newRefreshToken ?? tokenUpdate.newRefreshToken,
    newAccessToken: orgsUpdate.newAccessToken ?? tokenUpdate.newAccessToken,
    newAccessTokenExpiry: orgsUpdate.newAccessTokenExpiry ?? tokenUpdate.newAccessTokenExpiry,
  }

  const data = await orgsRes.json() as { organizations?: HubstaffOrganization[] }
  return {
    organizations: data.organizations ?? [],
    tokenUpdate: finalUpdate,
  }
}

// Loose type for a single page from GET /organizations/{id}/members
// Handles both API shapes:
//   Shape A (inline):    { members: [{ user_id, user: { id, name, email } }] }
//   Shape B (sideloaded): { members: [{ user_id }], users: [{ id, name, email }] }
//   Shape C (flat):       { members: [{ user_id }] }
interface MembersRaw {
  members?: Array<{
    user_id: number
    user?: { id?: number; name?: string; email?: string; status?: string } | null
  }>
  users?: Array<{ id: number; name: string; email?: string }>
  pagination?: { next_page_start_id?: number | null }
}

const MAX_MEMBER_PAGES = 20  // 20 × 100 = 2 000 members max

export async function fetchHubstaffMembers(
  orgId: string,
  tokenState: HubstaffTokenState,
): Promise<{ members: HubstaffMember[]; tokenUpdate: HubstaffTokenUpdate }> {
  type RawMember = NonNullable<MembersRaw['members']>[number]

  const allRaw: RawMember[] = []
  const sideloadedUsers = new Map<number, { name: string; email: string }>()
  let finalTokenUpdate: HubstaffTokenUpdate = { newRefreshToken: null, newAccessToken: null, newAccessTokenExpiry: null }
  let currentState = tokenState
  let pageStartId: number | null = 0
  let pageCount = 0

  do {
    const extraParams: Record<string, string> = {
      'include[]': 'users',
      'page_limit': '100',   // members endpoint uses underscore, not bracket notation
    }
    if (pageStartId) extraParams['page_start_id'] = String(pageStartId)

    const { res, tokenUpdate } = await fetchHubstaff(`organizations/${orgId}/members`, currentState, extraParams)

    // Propagate token rotation so subsequent pages reuse the new access token
    if (tokenUpdate.newAccessToken) {
      currentState = {
        refreshToken: tokenUpdate.newRefreshToken ?? currentState.refreshToken,
        cachedAccessToken: tokenUpdate.newAccessToken,
        cachedAccessTokenExpiry: tokenUpdate.newAccessTokenExpiry ?? undefined,
      }
      finalTokenUpdate = tokenUpdate
    } else if (pageCount === 0) {
      finalTokenUpdate = tokenUpdate
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
      throw new Error(err.error ?? `Hubstaff error ${res.status}`)
    }

    const data = await res.json() as MembersRaw

    allRaw.push(...(data.members ?? []))
    const pageUsers = data.users ?? []
    for (const u of pageUsers) sideloadedUsers.set(u.id, { name: u.name, email: (u.email ?? '').trim() })

    pageStartId = data.pagination?.next_page_start_id ?? null
    pageCount++
  } while (pageStartId && pageCount < MAX_MEMBER_PAGES)


  // Shape A: inline member.user
  let members: HubstaffMember[] = allRaw
    .filter((m) => m?.user?.id != null)
    .map((m) => ({
      id: m.user!.id ?? m.user_id,
      name: m.user!.name ?? '',
      email: (m.user!.email ?? '').trim(),
      status: m.user!.status ?? 'active',
    }))

  // Shape B: sideloaded root-level users array
  if (members.length === 0 && sideloadedUsers.size > 0) {
    members = allRaw.map((m) => {
      const u = sideloadedUsers.get(m.user_id)
      return { id: m.user_id, name: u?.name ?? '', email: u?.email ?? '', status: 'active' }
    })
  }

  // Shape C: flat members with no user details — return stubs so mapping UI shows User #ID
  if (members.length === 0 && allRaw.length > 0) {
    members = allRaw.map((m) => ({ id: m.user_id, name: '', email: '', status: 'active' }))
  }

  return { members, tokenUpdate: finalTokenUpdate }
}

// ─── User profile cache ────────────────────────────────────────────────────────

const PROFILE_CACHE_KEY = 'spectra_hs_profiles'
const PROFILE_CACHE_TTL = 24 * 60 * 60 * 1000  // 24 h

interface CachedProfile { id: number; name: string; email: string; at: number }

function loadProfileCache(): Map<number, CachedProfile> {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY)
    if (!raw) return new Map()
    const entries = JSON.parse(raw) as [number, CachedProfile][]
    const now = Date.now()
    return new Map(entries.filter(([, p]) => now - p.at < PROFILE_CACHE_TTL))
  } catch { return new Map() }
}

function saveProfileCache(cache: Map<number, CachedProfile>): void {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify([...cache.entries()]))
  } catch { /* quota exceeded — operate without persisting */ }
}

/**
 * Batch-fetches user profiles via GET /v2/users/{id}.
 * Caches results in localStorage for 24 h so repeated payroll runs don't re-fetch.
 * Call with a tokenState that has a valid cachedAccessToken to avoid re-exchanging
 * the refresh token on every parallel request.
 */
export async function fetchUserProfiles(
  userIds: number[],
  tokenState: HubstaffTokenState,
): Promise<Map<number, { name: string; email: string }>> {
  if (userIds.length === 0) return new Map()

  const cache = loadProfileCache()
  const missing = userIds.filter((id) => !cache.has(id))

  if (missing.length > 0) {
    const BATCH = 10
    for (let i = 0; i < missing.length; i += BATCH) {
      const batch = missing.slice(i, i + BATCH)
      await Promise.all(batch.map(async (id) => {
        try {
          const { res } = await fetchHubstaff(`users/${id}`, tokenState)
          if (!res.ok) return
          const data = await res.json() as { user?: { id?: number; name?: string; email?: string } }
          if (data.user?.id) {
            cache.set(id, { id, name: data.user.name ?? '', email: data.user.email ?? '', at: Date.now() })
          }
        } catch { /* skip — profile stays missing */ }
      }))
      // Brief pause between batches to avoid hammering the API
      if (i + BATCH < missing.length) await new Promise<void>((r) => setTimeout(r, 300))
    }
    saveProfileCache(cache)
  }

  return new Map(
    userIds
      .filter((id) => cache.has(id))
      .map((id) => [id, { name: cache.get(id)!.name, email: cache.get(id)!.email }]),
  )
}

export interface EmployeeHoursMap {
  [userId: string]: { regular: number; ot: number; holiday: number; total: number }
}

// Loose type for the raw /activities/daily response.
//
// NIGHT-SHIFT GRANULARITY NOTE (investigated for the night-incentive feature):
// The /v2/organizations/{id}/activities/daily endpoint we use returns ONLY a
// per-user, per-DAY total in `tracked` (seconds). Each daily_activities record is
// { user_id, date, tracked } — there are NO start_time / stop_time timestamps and
// NO intra-day time blocks. So time-of-day cannot be derived here and night hours
// CANNOT be computed automatically from this endpoint.
//   → Night hours are entered MANUALLY by the manager in the Review Hours table
//     (see EmployeeHoursEntry.nightHours + StepHours), and the mixed-shift threshold
//     is applied on the night/total ratio in calculatePayroll.
// (Hubstaff's non-daily /activities or /timesheets endpoints DO expose start/stop
//  times; switching to those in the future would enable automatic night detection.)
interface ActivitiesRaw {
  daily_activities?: Array<{ user_id: number; date: string; tracked: number }>
  users?: Array<{ id: number; name: string; email?: string }>
  members?: Array<{ user_id: number; user?: { id?: number; name?: string; email?: string } | null }>
  pagination?: { next_page_start_id?: number | null }
}

const MAX_PAGES = 50  // safety limit — 50 × 500 = 25 000 activity records

export async function fetchHoursForPeriod(
  orgId: string,
  tokenState: HubstaffTokenState,
  startDate: string,
  endDate: string,
  otThreshold: number,
  frequency: 'biweekly' | 'weekly' | 'full_month',
  // YYYY-MM-DD dates that are public holidays for the period's country. Hours tracked on
  // these days are split out as holiday hours (paid at the holiday rate) and excluded from
  // the weekly OT calculation. Matched by EXACT string equality — no Date/timezone parsing.
  holidayDates: string[] = [],
): Promise<{ hoursMap: EmployeeHoursMap; users: HubstaffActivityUser[]; tokenUpdate: HubstaffTokenUpdate }> {
  if (!startDate || !endDate) {
    throw new Error('Period dates are required to fetch Hubstaff hours')
  }

  const allActivities: Array<{ user_id: number; date: string; tracked: number }> = []
  let activityUsers: HubstaffActivityUser[] = []
  let finalTokenUpdate: HubstaffTokenUpdate = { newRefreshToken: null, newAccessToken: null, newAccessTokenExpiry: null }
  let currentTokenState = tokenState
  let pageStartId: number | null = 0   // 0 = first page sentinel (no page_start_id param)
  let pageCount = 0

  do {
    const extraParams: Record<string, string> = {
      'date[start]': startDate,
      'date[stop]': endDate,
      'page[limit]': '500',
    }
    if (pageStartId) extraParams['page_start_id'] = String(pageStartId)


    const { res, tokenUpdate } = await fetchHubstaff(
      `organizations/${orgId}/activities/daily`,
      currentTokenState,
      extraParams,
    )

    // Propagate token rotation so subsequent pages reuse the new access token
    if (tokenUpdate.newAccessToken) {
      currentTokenState = {
        refreshToken: tokenUpdate.newRefreshToken ?? currentTokenState.refreshToken,
        cachedAccessToken: tokenUpdate.newAccessToken,
        cachedAccessTokenExpiry: tokenUpdate.newAccessTokenExpiry ?? undefined,
      }
      finalTokenUpdate = tokenUpdate
    } else if (pageCount === 0) {
      finalTokenUpdate = tokenUpdate
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
      throw new Error(err.error ?? `Hubstaff error ${res.status}`)
    }

    const data = await res.json() as ActivitiesRaw
    allActivities.push(...(data.daily_activities ?? []))

    // Capture user roster from first page that includes it
    if (activityUsers.length === 0 && (data.users ?? []).length > 0) {
      activityUsers = (data.users ?? []).map((u) => ({ id: u.id, name: u.name, email: u.email ?? '' }))
    }

    pageStartId = data.pagination?.next_page_start_id ?? null
    pageCount++
  } while (pageStartId && pageCount < MAX_PAGES)


  const userDailyHours: Record<string, Record<string, number>> = {}
  for (const activity of allActivities) {
    const uid = String(activity.user_id)
    const hours = activity.tracked / 3600
    if (!userDailyHours[uid]) userDailyHours[uid] = {}
    userDailyHours[uid][activity.date] = (userDailyHours[uid][activity.date] ?? 0) + hours
  }

  const holidaySet = new Set(holidayDates)
  const hoursMap: EmployeeHoursMap = {}
  for (const [uid, dailyMap] of Object.entries(userDailyHours)) {
    // Split each day: holiday-date hours → holiday bucket; the rest feed the weekly OT split.
    let holidayHrs = 0
    const workDaily: Record<string, number> = {}
    for (const [date, hrs] of Object.entries(dailyMap)) {
      if (holidaySet.has(date)) holidayHrs += hrs
      else workDaily[date] = hrs
    }

    const weeks = groupDailyIntoWeeks(workDaily, startDate, endDate, frequency, otThreshold)
    let totalRegular = 0
    let totalOT = 0
    for (const week of weeks) {
      totalRegular += week.regular
      totalOT += week.ot
    }
    const regular = roundHalfUp(totalRegular, 2)
    const ot = roundHalfUp(totalOT, 2)
    const holiday = roundHalfUp(holidayHrs, 2)
    hoursMap[uid] = {
      regular,
      ot,
      holiday,
      total: roundHalfUp(regular + ot + holiday, 2),
    }
  }

  return { hoursMap, users: activityUsers, tokenUpdate: finalTokenUpdate }
}

// Returns the ISO week Monday (YYYY-MM-DD) for any date
function isoWeekMonday(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun, 1=Mon, …, 6=Sat
  const offset = day === 0 ? -6 : 1 - day   // shift back to Monday
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

// Groups every day in [startDate, endDate] by its ISO week (Mon–Sun),
// sums hours per week, then applies the OT threshold to each week.
// This correctly handles biweekly periods of any length (14 or 15 days)
// and aligns OT with calendar weeks as required by Dominican labor law.
function groupDailyIntoWeeks(
  dailyMap: Record<string, number>,
  startDate: string,
  endDate: string,
  _frequency: 'biweekly' | 'weekly' | 'full_month',
  otThreshold: number,
): WeeklyHours[] {
  const weekHours = new Map<string, number>()
  const weekOrder: string[] = []

  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const current = new Date(start)

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    const weekKey = isoWeekMonday(new Date(current))

    if (!weekHours.has(weekKey)) {
      weekHours.set(weekKey, 0)
      weekOrder.push(weekKey)
    }
    weekHours.set(weekKey, (weekHours.get(weekKey) ?? 0) + (dailyMap[dateStr] ?? 0))
    current.setDate(current.getDate() + 1)
  }

  return weekOrder.map((weekKey) => {
    const hours = weekHours.get(weekKey) ?? 0
    return {
      weekStart: weekKey,
      regular: Math.min(hours, otThreshold),
      ot: Math.max(0, hours - otThreshold),
    }
  })
}
