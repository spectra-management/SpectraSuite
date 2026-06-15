import type { HubstaffMembersResponse, HubstaffMember, WeeklyHours } from './types'
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
  const params = new URLSearchParams({ endpoint, ...(extra ?? {}) })
  return `/api/hubstaff?${params.toString()}`
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

  // Use the fresh access token (if we just exchanged) for the second call — avoids a second exchange
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

export async function fetchHubstaffMembers(
  orgId: string,
  tokenState: HubstaffTokenState,
): Promise<{ members: HubstaffMember[]; tokenUpdate: HubstaffTokenUpdate }> {
  const { res, tokenUpdate } = await fetchHubstaff(`organizations/${orgId}/members`, tokenState)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(err.error ?? `Hubstaff error ${res.status}`)
  }
  const data = await res.json() as HubstaffMembersResponse
  return { members: data.members ?? [], tokenUpdate }
}

export interface EmployeeHoursMap {
  [userId: string]: { regular: number; ot: number; total: number }
}

export async function fetchHoursForPeriod(
  orgId: string,
  tokenState: HubstaffTokenState,
  startDate: string,
  endDate: string,
  otThreshold: number,
  frequency: 'biweekly' | 'weekly',
): Promise<{ hoursMap: EmployeeHoursMap; tokenUpdate: HubstaffTokenUpdate }> {
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
  const data = await res.json() as { daily_activities?: Array<{ user_id: number; date: string; tracked: number }> }
  const activities = data.daily_activities ?? []

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

  return { hoursMap, tokenUpdate }
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
