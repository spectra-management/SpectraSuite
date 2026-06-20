import { supabase, isSupabaseConfigured } from './supabase'
import type { AuditCategory } from '@/shared/types/supabase'

export interface AuditLogEntry {
  action: string
  category: AuditCategory
  resource_type?: string
  resource_id?: string
  details?: Record<string, unknown>
  status?: 'success' | 'failure'
  error_message?: string
}

/**
 * Record an audit entry through the server-side SECURITY DEFINER RPC
 * `log_audit_event` (see migration 007). The RPC stamps auth.uid() server-side
 * and is the ONLY way to write audit_log — the table is read-only to clients via
 * RLS, so records are tamper-proof (users can't insert/update/delete their own).
 *
 * Best-effort and never throws — auditing must not break the action it records.
 * Returns the new log id, or null on failure / when unauthenticated.
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  try {
    const { data, error } = await supabase.rpc('log_audit_event', {
      p_action: entry.action,
      p_category: entry.category,
      p_resource_type: entry.resource_type ?? null,
      p_resource_id: entry.resource_id ?? null,
      p_details: entry.details ?? null,
      p_status: entry.status ?? 'success',
      p_error_message: entry.error_message ?? null,
    })
    if (error) {
      console.error('[audit] RPC error:', error.message)
      return null
    }
    return (data as string) ?? null
  } catch (err) {
    console.error('[audit] failed to log event:', err)
    return null
  }
}
