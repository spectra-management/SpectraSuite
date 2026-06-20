import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/shared/lib/supabase'
import type { AuditLogRow } from '@/shared/types/supabase'

export interface AuditLogFilters {
  /** Free-text — matched (ILIKE) across user_email, action, resource_id. */
  search?: string
  category?: string  // '' / 'all' → no filter
  status?: string    // '' / 'all' → no filter
  startDate?: string // YYYY-MM-DD (inclusive)
  endDate?: string   // YYYY-MM-DD (inclusive)
}

interface UseAuditLogOptions {
  pageSize?: number
  filters?: AuditLogFilters
}

const EXPORT_CAP = 10_000

// Apply the filter set to a query builder (shared by the paged fetch + export).
function applyFilters<Q extends ReturnType<ReturnType<typeof supabase.from>['select']>>(query: Q, f: AuditLogFilters): Q {
  let q = query
  if (f.category && f.category !== 'all') q = q.eq('category', f.category) as Q
  if (f.status && f.status !== 'all') q = q.eq('status', f.status) as Q
  if (f.startDate) q = q.gte('created_at', f.startDate) as Q
  if (f.endDate) q = q.lte('created_at', `${f.endDate}T23:59:59.999`) as Q
  const s = f.search?.replace(/[%,()]/g, ' ').trim()
  if (s) q = q.or(`user_email.ilike.%${s}%,action.ilike.%${s}%,resource_id.ilike.%${s}%`) as Q
  return q
}

/**
 * Server-side paginated audit-log reader. Uses Supabase `.range()` + an exact
 * row count so the table scales past any client-side cap; filtering happens in
 * the database, not the browser.
 */
export function useAuditLog({ pageSize = 25, filters = {} }: UseAuditLogOptions = {}) {
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [page, setPage] = useState(0)         // 0-indexed
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stable dependency for the effect/callback (object identity changes each render).
  const filterKey = JSON.stringify(filters)

  const fetchLogs = useCallback(async (pageNumber: number) => {
    setLoading(true)
    setError(null)
    try {
      const f: AuditLogFilters = JSON.parse(filterKey)
      const base = supabase.from('audit_log').select('*', { count: 'exact' }).order('created_at', { ascending: false })
      const start = pageNumber * pageSize
      const { data, error: fetchError, count } = await applyFilters(base, f).range(start, start + pageSize - 1)
      if (fetchError) throw fetchError
      setLogs(data ?? [])
      setTotalCount(count ?? 0)
      setPage(pageNumber)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs')
      setLogs([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [pageSize, filterKey])

  // Reset to the first page whenever filters or page size change.
  useEffect(() => { void fetchLogs(0) }, [fetchLogs])

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const hasNextPage = page < totalPages - 1
  const hasPrevPage = page > 0

  const goToPage = (n: number) => { if (n >= 0 && n < totalPages) void fetchLogs(n) }
  const nextPage = () => { if (hasNextPage) void fetchLogs(page + 1) }
  const prevPage = () => { if (hasPrevPage) void fetchLogs(page - 1) }

  /** Fetch ALL matching rows (capped) for CSV export — bypasses pagination. */
  const fetchForExport = useCallback(async (): Promise<AuditLogRow[]> => {
    const f: AuditLogFilters = JSON.parse(filterKey)
    const base = supabase.from('audit_log').select('*').order('created_at', { ascending: false })
    const { data, error: e } = await applyFilters(base, f).range(0, EXPORT_CAP - 1)
    if (e) throw e
    return data ?? []
  }, [filterKey])

  return {
    logs, page, pageSize, totalCount, totalPages, loading, error,
    goToPage, nextPage, prevPage, hasNextPage, hasPrevPage, fetchForExport,
  }
}
