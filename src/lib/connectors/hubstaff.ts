import type { HubstaffMember, HubstaffActivityUser, WeeklyHours } from './types'
export type { HubstaffActivityUser }
import { roundHalfUp } from '@/lib/payroll/calculations'

const ACCESS_TOKEN_MARGIN_MS = 5 * 60 * 1000  // skip exchange if token expires within 5 min

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

// Loose type for the raw /members response — handles both API shapes:
//   Shape A (inline):    { members: [{ user_id, user: { id, name, email } }] }
//   Shape B (sideloaded): { members: [{ user_id }], users: [{ id, name, email }] }
interface MembersRaw {
  members?: Array<{
    user_id: number
    user?: { id?: number; name?: string; email?: string; status?: string } | null
  }>
  users?: Array<{ id: number; name: string; email?: string }>
}

export async function fetchHubstaffMembers(
  orgId: string,
  tokenState: HubstaffTokenState,
): Promise<{ members: HubstaffMember[]; tokenUpdate: HubstaffTokenUpdate }> {
  const { res, tokenUpdate } = await fetchHubstaff(`organizations/${orgId}/members`, tokenState)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(err.error ?? `Hubstaff error ${res.status}`)
  }

  const data = await res.json() as MembersRaw

  // Log first element of raw response for structure verification
  const firstMember = data.members?.[0]
  console.log('[hubstaff] /members raw first element:', JSON.stringify(firstMember))
  console.log('[hubstaff] /members root keys:', Object.keys(data))

  // Shape A: user details nested inline under member.user
  let members: HubstaffMember[] = (data.members ?? [])
    .filter((m) => m?.user?.id != null)
    .map((m) => ({
      id: m.user!.id ?? m.user_id,
      name: m.user!.name ?? '',
      email: m.user!.email ?? '',
      status: m.user!.status ?? 'active',
    }))

  // Shape B: user details sideloaded at root-level users array (match by user_id)
  if (members.length === 0 && (data.users ?? []).length > 0) {
    const userById = new Map((data.users ?? []).map((u) => [u.id, u]))
    members = (data.members ?? [])
      .map((m) => {
        const u = userById.get(m.user_id)
        return u ? { id: u.id, name: u.name, email: u.email ?? '', status: 'active' } : null
      })
      .filter((m): m is HubstaffMember => m !== null)
  }

  console.log('[hubstaff] fetchHubstaffMembers → raw members:', data.members?.length ?? 0, 'parsed:', members.length)
  return { members, tokenUpdate }
}

export interface EmployeeHoursMap {
  [userId: string]: { regular: number; ot: number; total: number }
}

// Loose type for the raw /activities/daily response
interface ActivitiesRaw {
  daily_activities?: Array<{ user_id: number; date: string; tracked: number }>
  users?: Array<{ id: number; name: string; email?: string }>
  members?: Array<{ user_id: number; user?: { id?: number; name?: string; email?: string } | null }>
}

export async function fetchHoursForPeriod(
  orgId: string,
  tokenState: HubstaffTokenState,
  startDate: string,
  endDate: string,
  otThreshold: number,
  frequency: 'biweekly' | 'weekly',
): Promise<{ hoursMap: EmployeeHoursMap; users: HubstaffActivityUser[]; tokenUpdate: HubstaffTokenUpdate }> {
  if (!startDate || !endDate) {
    throw new Error('Period dates are required to fetch Hubstaff hours')
  }
  const { res, tokenUpdate } = await fetchHubstaff(
    `organizations/${orgId}/activities/daily`,
    tokenState,
    { 'date[start]': startDate, 'date[stop]': endDate, 'page[size]': '1000' },
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(err.error ?? `Hubstaff error ${res.status}`)
  }

  const data = await res.json() as ActivitiesRaw

  // Log root keys and user/member counts for structure verification
  console.log('[hubstaff] /activities/daily root keys:', Object.keys(data))
  console.log('[hubstaff] users array length:', data.users?.length ?? 'key missing')
  console.log('[hubstaff] first activity:', JSON.stringify(data.daily_activities?.[0]))

  const activities = data.daily_activities ?? []

  // Primary: root-level users array (confirmed in Hubstaff v2 spec)
  let users: HubstaffActivityUser[] = (data.users ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email ?? '',
  }))

  // Fallback: members sideloaded in activities response (some API versions)
  if (users.length === 0 && (data.members ?? []).length > 0) {
    users = (data.members ?? [])
      .filter((m) => m?.user?.id != null)
      .map((m) => ({
        id: m.user!.id!,
        name: m.user!.name ?? '',
        email: m.user!.email ?? '',
      }))
  }

  console.log('[hubstaff] fetchHoursForPeriod → activities:', activities.length, 'users resolved:', users.length)

  const userDailyHours: Record<string, Record<string, number>> = {}
  for (const activity of activities) {
    const uid = String(activity.user_id)
    const hours = activity.tracked / 3600
    if (!userDailyHours[uid]) userDailyHours[uid] = {}
    userDailyHours[uid][activity.date] = (userDailyHours[uid][activity.date] ?? 0) + hours
  }

  const hoursMap: EmployeeHoursMap = {}
  for (const [uid, dailyMap] of Object.entries(userDailyHours)) {
    const weeks = groupDailyIntoWeeks(dailyMap, startDate, endDate, frequency, otThreshold)
    let totalRegular = 0
    let totalOT = 0
    for (const week of weeks) {
      totalRegular += week.regular
      totalOT += week.ot
    }
    const total = roundHalfUp(totalRegular + totalOT, 2)
    hoursMap[uid] = {
      regular: roundHalfUp(totalRegular, 2),
      ot: roundHalfUp(totalOT, 2),
      total,
    }
  }

  return { hoursMap, users, tokenUpdate }
}

function groupDailyIntoWeeks(
  dailyMap: Record<string, number>,
  startDate: string,
  endDate: string,
  frequency: 'biweekly' | 'weekly',
  otThreshold: number,
): WeeklyHours[] {
  const weeks: WeeklyHours[] = []
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const weeksCount = frequency === 'biweekly' ? 2 : 1

  for (let w = 0; w < weeksCount; w++) {
    const weekStart = new Date(start)
    weekStart.setDate(start.getDate() + w * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const actualEnd = weekEnd > end ? end : weekEnd

    let weekHours = 0
    const current = new Date(weekStart)
    while (current <= actualEnd) {
      const dateStr = current.toISOString().split('T')[0]
      weekHours += dailyMap[dateStr] ?? 0
      current.setDate(current.getDate() + 1)
    }

    weeks.push({
      weekStart: weekStart.toISOString().split('T')[0],
      regular: Math.min(weekHours, otThreshold),
      ot: Math.max(0, weekHours - otThreshold),
    })
  }

  return weeks
}
