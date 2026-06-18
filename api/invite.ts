import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ============================================================================
// POST /api/invite — invite a new Suite user by email (super_admin only).
//
// Uses the Supabase SERVICE ROLE key (server-side only — never exposed to the
// client) to call auth.admin.inviteUserByEmail(). The invited user receives an
// email with a magic link; after they authenticate via Google they land in /suite.
//
// Required env vars (Vercel project settings):
//   - VITE_SUPABASE_URL          (the project URL, reused server-side)
//   - SUPABASE_SERVICE_ROLE_KEY  (secret — Project Settings → API)
//
// Authorization: the caller must send their Supabase access token as a Bearer
// token; we verify it belongs to a super_admin before inviting.
// ============================================================================

interface InviteBody {
  email: string
  redirectTo?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Supabase server env vars are not configured' })
  }

  const { email, redirectTo } = (req.body ?? {}) as InviteBody
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Missing required field: email' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Verify the caller is an authenticated super_admin.
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Missing authorization token' })

  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData.user) {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()
  if (profileErr || profile?.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only super admins can invite users' })
  }

  // Send the invite.
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectTo || undefined,
  })
  if (error) {
    return res.status(400).json({ error: error.message })
  }

  return res.status(200).json({ ok: true, userId: data.user?.id ?? null })
}
