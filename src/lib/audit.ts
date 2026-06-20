import { supabase, isSupabaseConfigured } from './supabase'
import type { AuditCategory } from '@/types/supabase'

export interface AuditLogEntry {
  action: string
  category: AuditCategory
  resource_type?: string
  resource_id?: string
  details?: Record<string, unknown>
  status?: 'success' | 'failure'
  error_message?: string
}

// Cache the client IP for the session — avoids hitting ipify on every event.
let cachedIp: string | null | undefined

async function getClientIP(): Promise<string | null> {
  if (cachedIp !== undefined) return cachedIp
  try {
    const res = await fetch('https://api.ipify.org?format=json')
    const data = (await res.json()) as { ip?: string }
    cachedIp = data.ip ?? null
  } catch {
    cachedIp = null
  }
  return cachedIp
}

/**
 * Write an audit entry. Best-effort and never throws — auditing must not break the
 * user-facing action it records. No-ops when Supabase isn't configured or no one
 * is signed in (RLS requires user_id = auth.uid()).
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return
    const { error } = await supabase.from('audit_log').insert({
      user_id: session.user.id,
      user_email: session.user.email ?? null,
      action: entry.action,
      category: entry.category,
      resource_type: entry.resource_type ?? null,
      resource_id: entry.resource_id ?? null,
      details: entry.details ?? null,
      ip_address: await getClientIP(),
      user_agent: navigator.userAgent,
      status: entry.status ?? 'success',
      error_message: entry.error_message ?? null,
    })
    if (error) console.error('[audit] insert error:', error.message)
  } catch (err) {
    console.error('[audit] failed to log event:', err)
  }
}
