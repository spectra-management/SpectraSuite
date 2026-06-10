import type { HubstaffMembersResponse, HubstaffMember, WeeklyHours } from './types'
import { roundHalfUp } from '@/lib/payroll/calculations'

function buildUrl(endpoint: string, token: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({
    endpoint,
    token,
    ...(extra ?? {}),
  })
  return `/api/hubstaff?${params.toString()}`
}

export async function fetchHubstaffMembers(
  orgId: string,
  token: string,
): Promise<HubstaffMember[]> {
  const res = await fetch(buildUrl(`organizations/${orgId}/members`, token))
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' })) as { error?: string }
    throw new Error(err.error ?? `Hubstaff error ${res.status}`)
  }
  const data = await res.json() as HubstaffMembersResponse
  return data.members ?? []
}

export interface EmployeeHoursMap {
  [userId: string]: { regular: number; ot: number; total: number }
}

export async function fetchHoursForPeriod(
  orgId: string,
  token: string,
  startDate: string,
  endDate: string,
  otThreshold: number,
  frequency: 'biweekly' | 'weekly',
): Promise<EmployeeHoursMap> {
  const res = await fetch(
    buildUrl(`organizations/${orgId}/activities/daily`, token, {
      date_from: startDate,
      date_to: endDate,
      'page[size]': '1000',
    }),
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

  const result: EmployeeHoursMap = {}
  for (const [uid, dailyMap] of Object.entries(userDailyHours)) {
    const weeks = groupDailyIntoWeeks(dailyMap, startDate, endDate, frequency, otThreshold)
    let totalRegular = 0
    let totalOT = 0
    for (const week of weeks) {
      totalRegular += week.regular
      totalOT += week.ot
    }
    const total = roundHalfUp(totalRegular + totalOT, 2)
    result[uid] = {
      regular: roundHalfUp(totalRegular, 2),
      ot: roundHalfUp(totalOT, 2),
      total,
    }
  }

  return result
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

    const regular = Math.min(weekHours, otThreshold)
    const ot = Math.max(0, weekHours - otThreshold)
    weeks.push({
      weekStart: weekStart.toISOString().split('T')[0],
      regular,
      ot,
    })
  }

  return weeks
}
