// ============================================================================
// Google Tasks + Calendar REST helpers (Part 8).
//
// Auth: the user signs in with Google via Supabase OAuth. The resulting
// `provider_token` (see AuthContext.googleProviderToken) is used as a Bearer
// token here. The OAuth request must include these scopes (set in Login.tsx):
//   - https://www.googleapis.com/auth/tasks
//   - https://www.googleapis.com/auth/calendar.readonly
//
// REMINDER: enable the "Google Tasks API" and "Google Calendar API" in the
// Google Cloud Console for the OAuth client, or these calls return 403.
// ============================================================================

const TASKS_BASE = 'https://tasks.googleapis.com/tasks/v1'
const CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3'

export interface GoogleTask {
  id: string
  title: string
  status: 'needsAction' | 'completed'
  due?: string
}

export interface GoogleCalendarEvent {
  id: string
  summary: string
  start: string          // ISO datetime or date
  isAllDay: boolean
  htmlLink: string
  colorId?: string
}

/** Thrown when the provider token is missing/expired so the UI can show a reconnect hint. */
export class GoogleAuthError extends Error {}

async function googleFetch<T>(url: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (res.status === 401 || res.status === 403) {
    throw new GoogleAuthError(`Google API auth failed (${res.status})`)
  }
  if (!res.ok) throw new Error(`Google API error ${res.status}`)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

/** Returns tasks from the user's default task list. */
export async function fetchGoogleTasks(token: string): Promise<GoogleTask[]> {
  const lists = await googleFetch<{ items?: { id: string }[] }>(
    `${TASKS_BASE}/users/@me/lists`,
    token,
  )
  const listId = lists.items?.[0]?.id
  if (!listId) return []
  const data = await googleFetch<{ items?: GoogleTask[] }>(
    `${TASKS_BASE}/lists/${listId}/tasks?showCompleted=true&maxResults=50`,
    token,
  )
  return data.items ?? []
}

async function defaultListId(token: string): Promise<string | null> {
  const lists = await googleFetch<{ items?: { id: string }[] }>(
    `${TASKS_BASE}/users/@me/lists`,
    token,
  )
  return lists.items?.[0]?.id ?? null
}

export async function addGoogleTask(token: string, title: string): Promise<GoogleTask | null> {
  const listId = await defaultListId(token)
  if (!listId) return null
  return googleFetch<GoogleTask>(`${TASKS_BASE}/lists/${listId}/tasks`, token, {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export async function completeGoogleTask(token: string, taskId: string): Promise<void> {
  const listId = await defaultListId(token)
  if (!listId) return
  await googleFetch(`${TASKS_BASE}/lists/${listId}/tasks/${taskId}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed' }),
  })
}

export async function deleteGoogleTask(token: string, taskId: string): Promise<void> {
  const listId = await defaultListId(token)
  if (!listId) return
  await googleFetch(`${TASKS_BASE}/lists/${listId}/tasks/${taskId}`, token, { method: 'DELETE' })
}

// ─── Calendar ──────────────────────────────────────────────────────────────

/** Upcoming events for the next `days` days from the primary calendar. */
export async function fetchUpcomingEvents(
  token: string,
  timeMinISO: string,
  timeMaxISO: string,
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '20',
  })
  const data = await googleFetch<{
    items?: Array<{
      id: string
      summary?: string
      htmlLink: string
      colorId?: string
      start?: { dateTime?: string; date?: string }
    }>
  }>(`${CALENDAR_BASE}/calendars/primary/events?${params.toString()}`, token)

  return (data.items ?? []).map((e) => ({
    id: e.id,
    summary: e.summary ?? '(no title)',
    start: e.start?.dateTime ?? e.start?.date ?? '',
    isAllDay: !e.start?.dateTime,
    htmlLink: e.htmlLink,
    colorId: e.colorId,
  }))
}
