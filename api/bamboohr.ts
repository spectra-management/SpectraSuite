import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { path, subdomain, apiKey, ...extraQuery } = req.query

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path parameter is required' })
  }
  if (!subdomain || typeof subdomain !== 'string') {
    return res.status(400).json({ error: 'subdomain parameter is required' })
  }
  if (!apiKey || typeof apiKey !== 'string') {
    return res.status(400).json({ error: 'apiKey parameter is required' })
  }

  const credentials = Buffer.from(`${apiKey}:x`).toString('base64')

  // Forward extra query params (e.g., format=JSON for custom reports)
  const qs = new URLSearchParams()
  for (const [key, val] of Object.entries(extraQuery)) {
    if (typeof val === 'string') qs.append(key, val)
  }
  const queryString = qs.toString()
  const url = `https://api.bamboohr.com/api/gateway.php/${subdomain}${path}${queryString ? `?${queryString}` : ''}`

  try {
    const headers: Record<string, string> = {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
    }

    const fetchOptions: RequestInit = {
      method: req.method ?? 'GET',
      headers,
    }

    if (req.method === 'POST' && req.body) {
      headers['Content-Type'] = 'application/json'
      fetchOptions.body = JSON.stringify(req.body)
    }

    const response = await fetch(url, fetchOptions)

    if (response.status === 401) {
      return res.status(401).json({ error: 'Unauthorized — check your BambooHR API key' })
    }
    if (response.status === 404) {
      return res.status(404).json({ error: 'BambooHR resource not found' })
    }
    if (!response.ok) {
      const text = await response.text()
      return res.status(response.status).json({ error: text || 'BambooHR API error' })
    }

    // Employee photo endpoint (GET /v1/employees/{id}/photo/{size}) returns binary image
    // data, not JSON. Stream it through verbatim with its content-type so an <img> can
    // render it. This branch is ADDITIVE and isolated — no other module requests a
    // `/photo/` path, so existing JSON behaviour (incl. Nómina's) is unchanged.
    if (path.includes('/photo/')) {
      const contentType = response.headers.get('content-type') ?? 'image/jpeg'
      const buffer = Buffer.from(await response.arrayBuffer())
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
      return res.status(200).send(buffer)
    }

    const data: unknown = await response.json()

    // Vacation proxy: GET /v1/time_off/requests returns ALL approved time-off types.
    // Filter to Vacation (type.id === 83) so callers receive vacations only.
    if (path.includes('time_off/requests') && Array.isArray(data)) {
      const vacations = (data as Array<{ type?: { id?: string | number } }>)
        .filter((r) => String(r.type?.id) === '83')
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate')
      return res.status(200).json(vacations)
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate')
    return res.status(200).json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    return res.status(500).json({ error: message })
  }
}
