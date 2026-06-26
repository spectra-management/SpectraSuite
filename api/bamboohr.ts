import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { path, subdomain: qSubdomain, apiKey: qApiKey, ...extraQuery } = req.query

  if (!path || typeof path !== 'string') {
    return res.status(400).json({ error: 'path parameter is required' })
  }

  // Credential resolution. A client-provided value takes precedence (this preserves the
  // existing Nómina behaviour exactly — those callers still pass their key), otherwise we
  // fall back to the server-side environment. The photo path intentionally omits apiKey
  // from the client URL so the secret never appears in browser history / logs / the
  // Network tab — it is supplied HERE, server-side, from BAMBOOHR_API_KEY.
  const subdomain =
    (typeof qSubdomain === 'string' && qSubdomain) || process.env.BAMBOOHR_SUBDOMAIN || ''
  const apiKey =
    (typeof qApiKey === 'string' && qApiKey) || process.env.BAMBOOHR_API_KEY || ''

  if (!subdomain) {
    return res.status(400).json({ error: 'subdomain parameter is required' })
  }
  if (!apiKey) {
    return res.status(400).json({ error: 'apiKey parameter is required' })
  }

  const credentials = Buffer.from(`${apiKey}:x`).toString('base64')
  const isPhoto = path.includes('/photo/')
  // Employee file download: /v1/employees/{id}/files/{fileId} (NOT /files/view, which is JSON).
  const isFileDownload = /\/v1\/employees\/\d+\/files\/\d+\/?$/.test(path)

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
      // Photo / file-download requests must NOT ask for JSON — BambooHR returns raw binary.
      Accept: isPhoto ? 'image/*' : isFileDownload ? '*/*' : 'application/json',
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
    // data, not JSON. Read it as an arraybuffer (NOT .json()) and write the RAW bytes
    // with an image/* Content-Type so the browser <img> can render it.
    //
    // We use res.end(buffer) — not res.send()/res.json() — to write the bytes verbatim:
    // res.send() can re-infer / mislabel the Content-Type (the previous bug surfaced the
    // photo as Type "json"), whereas res.end() honours the header we set and never
    // JSON-serialises. The upstream Content-Type is trusted only when it is actually an
    // image/* type; otherwise we default to image/jpeg.
    //
    // This branch is ADDITIVE and isolated — no other module requests a `/photo/` path,
    // so existing JSON behaviour (incl. Nómina's) below is unchanged.
    if (isPhoto) {
      const upstreamType = response.headers.get('content-type') ?? ''
      const contentType = upstreamType.toLowerCase().startsWith('image/')
        ? upstreamType
        : 'image/jpeg'
      const buffer = Buffer.from(await response.arrayBuffer())
      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Length', String(buffer.length))
      // Cache in the BROWSER too (not just Vercel's CDN). The previous `s-maxage` only
      // cached at the edge, so the browser re-fetched every photo on each visit to the HR
      // directory — a visible reload/flicker. Employee photos rarely change, so let the
      // browser hold them for a day and serve stale-while-revalidate for a week.
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800')
      res.status(200)
      return res.end(buffer)
    }

    // Employee file download (GET /v1/employees/{id}/files/{fileId}) returns the raw file
    // binary. Stream it verbatim with the upstream content-type, served INLINE so PDFs/images
    // open in a new browser tab (other types download). apiKey is added server-side, so the
    // secret never reaches the client URL.
    if (isFileDownload) {
      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      const disposition = response.headers.get('content-disposition')
      const buffer = Buffer.from(await response.arrayBuffer())
      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Length', String(buffer.length))
      // Prefer inline so PDFs/images render in-tab; keep the upstream filename when present.
      res.setHeader('Content-Disposition', disposition ? disposition.replace(/^attachment/i, 'inline') : 'inline')
      res.setHeader('Cache-Control', 'private, max-age=300')
      res.status(200)
      return res.end(buffer)
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
