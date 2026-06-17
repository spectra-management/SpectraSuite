import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * TEMPORARY investigation endpoint — probes BambooHR time-off / vacation endpoints
 * and returns the raw responses so we can see what data is available for our account.
 *
 *   GET /api/bamboohr-vacation-test
 *
 * Auth: reads BAMBOOHR_API_KEY + BAMBOOHR_SUBDOMAIN from env (same credentials the
 * app uses server-side); falls back to ?apiKey= & ?subdomain= query params for local runs.
 *
 * Not wired into the app. Delete after inspection.
 */
interface ProbeResult {
  label: string
  url: string
  status: number | null
  ok: boolean
  data: unknown
}

async function probe(label: string, url: string, credentials: string): Promise<ProbeResult> {
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: 'application/json',
      },
    })
    const text = await response.text()
    let data: unknown = text
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      // BambooHR sometimes returns XML/plain text on error — keep the raw string.
      data = text
    }
    console.log(`[bamboohr-vacation-test] ${label} → ${response.status} ${url}`)
    console.log(`[bamboohr-vacation-test] ${label} raw:`, JSON.stringify(data, null, 2))
    return { label, url, status: response.status, ok: response.ok, data }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    console.error(`[bamboohr-vacation-test] ${label} failed:`, message)
    return { label, url, status: null, ok: false, data: { error: message } }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const subdomain =
    (typeof req.query.subdomain === 'string' && req.query.subdomain) ||
    process.env.BAMBOOHR_SUBDOMAIN ||
    ''
  const apiKey =
    (typeof req.query.apiKey === 'string' && req.query.apiKey) ||
    process.env.BAMBOOHR_API_KEY ||
    ''

  if (!subdomain || !apiKey) {
    return res.status(400).json({
      error: 'Missing BambooHR credentials. Set BAMBOOHR_SUBDOMAIN and BAMBOOHR_API_KEY env vars (or pass ?subdomain= & ?apiKey=).',
    })
  }

  const credentials = Buffer.from(`${apiKey}:x`).toString('base64')
  const base = `https://api.bamboohr.com/api/gateway.php/${subdomain}/v1`

  const [timeOffRequests, employeeTimeOffRequests, timeOffTypes] = await Promise.all([
    probe(
      'time_off/requests (approved, 2026)',
      `${base}/time_off/requests?status=approved&start=2026-01-01&end=2026-12-31`,
      credentials,
    ),
    probe(
      'employees/0/time_off/requests (all employees)',
      `${base}/employees/0/time_off/requests`,
      credentials,
    ),
    probe(
      'meta/time_off/types',
      `${base}/meta/time_off/types`,
      credentials,
    ),
  ])

  return res.status(200).json({
    note: 'Temporary BambooHR time-off probe. Inspect each entry: { label, url, status, ok, data }.',
    subdomain,
    results: { timeOffRequests, employeeTimeOffRequests, timeOffTypes },
  })
}
