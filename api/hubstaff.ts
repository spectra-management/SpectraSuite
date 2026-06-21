import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

interface ExchangeResult {
  accessToken: string
  newRefreshToken: string
  expiresIn: number
}

// Sentinel endpoint: a refresh-ONLY request. The client calls this (single-flighted)
// to obtain a fresh access token without also fetching data, so the rotation-sensitive
// refresh token is exchanged exactly once per cold cache.
const REFRESH_ENDPOINT = '__token_refresh__'

async function exchangeRefreshToken(refreshToken: string): Promise<ExchangeResult> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const res = await fetch('https://account.hubstaff.com/access_tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    if (res.status === 401) {
      throw new Error('Refresh token expired — generate a new one at developer.hubstaff.com')
    }
    throw new Error(`Hubstaff token exchange failed (${res.status}): ${text}`)
  }

  const data = await res.json() as TokenResponse
  if (!data.access_token) {
    throw new Error('Token exchange succeeded but access_token is missing in response')
  }

  return {
    accessToken: data.access_token,
    newRefreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 86399,
  }
}

/**
 * Persist the rotated refresh token to the Supabase `integrations` row (server-side,
 * service-role). Hubstaff ROTATES refresh tokens — each exchange invalidates the old
 * one — so the durable copy must be updated the moment a NEW token is minted.
 *
 * Invariants:
 *  - Called ONLY after a successful exchange (a failed exchange never reaches here),
 *    so a stale/failed value can never overwrite a good stored token.
 *  - Awaited by the caller before the single-flight lock releases (see refreshAccessToken).
 *  - Best-effort: if Supabase env vars are absent (offline/local build) it no-ops; the
 *    client still mirrors the rotated token into its own storage from the response.
 */
async function persistRotatedTokenToDb(newRefreshToken: string): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey || !newRefreshToken) return

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: existing } = await admin
      .from('integrations')
      .select('id, credentials')
      .eq('name', 'hubstaff')
      .limit(1)
      .maybeSingle()

    // Merge so orgId and other credential fields are preserved.
    const credentials = {
      ...((existing?.credentials as Record<string, unknown> | null) ?? {}),
      refreshToken: newRefreshToken,
    }
    const updatedAt = new Date().toISOString()

    if (existing?.id) {
      await admin.from('integrations').update({ credentials, updated_at: updatedAt }).eq('id', existing.id)
    } else {
      await admin.from('integrations').insert({ name: 'hubstaff', credentials, is_active: true, updated_at: updatedAt })
    }
  } catch (e) {
    // Durable mirror failed — the client's own copy is still updated from the response,
    // so the refresh itself is not lost. Log and move on.
    console.warn('[hubstaff proxy] DB token persist failed:', e)
  }
}

// ─── Single-flight refresh ───────────────────────────────────────────────────
// Within a warm serverless instance, concurrent callers share ONE in-flight
// exchange instead of each POSTing the same (rotating) refresh token. The real
// cross-tab/cross-call dedup happens client-side (see connectors/hubstaff.ts);
// this is the server-side belt-and-suspenders for requests that land together on
// one instance.
let inFlightRefresh: Promise<ExchangeResult> | null = null

async function refreshAccessToken(refreshToken: string): Promise<ExchangeResult> {
  if (inFlightRefresh) return inFlightRefresh

  inFlightRefresh = (async () => {
    try {
      const result = await exchangeRefreshToken(refreshToken)
      // Persist the rotated token BEFORE releasing the lock so no later caller can
      // read/exchange the now-invalidated one. Only reached on a successful exchange.
      await persistRotatedTokenToDb(result.newRefreshToken)
      return result
    } finally {
      inFlightRefresh = null
    }
  })()

  return inFlightRefresh
}

/**
 * Flatten query params into a flat Record<string, string>.
 * Handles both:
 *  - Flat format (Node querystring): { 'date[start]': '2026-06-01' }
 *  - Nested format (qs library):     { date: { start: '2026-06-01' } }
 * In both cases the result is { 'date[start]': '2026-06-01' }
 */
function flattenParams(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key
    if (typeof val === 'string') {
      result[fullKey] = val
    } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === 'string') {
      // Restore [] suffix so 'include[]=users' is forwarded correctly.
      // qs strips brackets during parsing: include[]=users → { include: ['users'] }
      // We reconstruct: { 'include[]': 'users' } → include[]=users in outgoing URL
      result[`${fullKey}[]`] = val[0] as string
    } else if (val !== null && typeof val === 'object') {
      Object.assign(result, flattenParams(val as Record<string, unknown>, fullKey))
    }
  }
  return result
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { endpoint, ...extraParams } = req.query
  const directAccessToken = req.headers['x-hubstaff-access-token']
  const refreshToken = req.headers['x-hubstaff-refresh-token']

  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'endpoint parameter is required' })
  }

  // ── Refresh-only path ──────────────────────────────────────────────────────
  // Returns a fresh access token (and the rotated refresh token) without a data
  // fetch. Single-flighted + DB-persisted via refreshAccessToken.
  if (endpoint === REFRESH_ENDPOINT) {
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(400).json({ error: 'x-hubstaff-refresh-token header is required to refresh' })
    }
    try {
      const exchanged = await refreshAccessToken(refreshToken)
      const expiry = Date.now() + exchanged.expiresIn * 1000
      res.setHeader('x-new-refresh-token', exchanged.newRefreshToken)
      res.setHeader('x-new-access-token', exchanged.accessToken)
      res.setHeader('x-access-token-expiry', String(expiry))
      return res.status(200).json({
        accessToken: exchanged.accessToken,
        refreshToken: exchanged.newRefreshToken,
        expiry,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token exchange failed'
      return res.status(401).json({ error: message })
    }
  }

  if (!directAccessToken && !refreshToken) {
    return res.status(400).json({ error: 'Either x-hubstaff-access-token or x-hubstaff-refresh-token header is required' })
  }

  let accessToken: string

  if (directAccessToken && typeof directAccessToken === 'string') {
    accessToken = directAccessToken
  } else {
    // Backward-compatible fallback: a data call that arrives with only a refresh
    // token. Route through the same single-flight + DB-persist path.
    if (typeof refreshToken !== 'string') {
      return res.status(400).json({ error: 'x-hubstaff-refresh-token must be a string' })
    }
    try {
      const exchanged = await refreshAccessToken(refreshToken)
      accessToken = exchanged.accessToken
      res.setHeader('x-new-refresh-token', exchanged.newRefreshToken)
      res.setHeader('x-new-access-token', exchanged.accessToken)
      res.setHeader('x-access-token-expiry', String(Date.now() + exchanged.expiresIn * 1000))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Token exchange failed'
      return res.status(401).json({ error: message })
    }
  }

  // Flatten bracket-keyed params (handles both querystring and qs-parsed formats),
  // then build the Hubstaff URL with literal bracket syntax — Hubstaff v2 requires
  // date[start]/date[stop] unencoded (date%5Bstart%5D is NOT accepted).
  const flat = flattenParams(extraParams as Record<string, unknown>)
  const queryParts = Object.entries(flat).map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
  const queryString = queryParts.join('&')
  const url = `https://api.hubstaff.com/v2/${endpoint}${queryString ? `?${queryString}` : ''}`

  console.log('[hubstaff proxy] →', url)

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    })

    console.log('[hubstaff proxy] ←', response.status, endpoint)

    if (response.status === 401) {
      return res.status(401).json({ error: 'Unauthorized — access token rejected by Hubstaff. Your refresh token may have expired.' })
    }
    if (response.status === 404) {
      return res.status(404).json({ error: 'Hubstaff resource not found' })
    }
    if (!response.ok) {
      const text = await response.text()
      console.error('[hubstaff proxy] error body:', text)
      return res.status(response.status).json({ error: text || 'Hubstaff API error' })
    }

    const data: unknown = await response.json()
    return res.status(200).json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    return res.status(500).json({ error: message })
  }
}
