import { useEffect, useMemo } from 'react'
import { useAuth } from '@/shared/context/AuthContext'
import { useEmployeeHrStore } from '@/shared/store/employeeHrStore'
import type { CloudEmployee } from '@/shared/connectors/bamboohr-hr'

/**
 * Resolve the employee record that belongs to the signed-in user.
 *
 * The link is by EMAIL: the user's login email is matched (case-insensitive) against the
 * employee's BambooHR work email. The employee directory comes from the DB-backed
 * `employeeHrStore` (hydrated on login) — for a non-admin user, RLS (migration 017) returns
 * only their own row, so the match is unambiguous.
 *
 * Returns `{ employee, ready }`:
 *  - `employee` is the matched CloudEmployee, or `null` when none matches.
 *  - `ready` is false only until the directory load ATTEMPT has finished. Once it has, `ready`
 *    is true even with no data, so callers show a "not linked" message instead of spinning
 *    forever. Cached data (localStorage) is treated as ready immediately.
 */
export function useCurrentEmployee(): { employee: CloudEmployee | null; ready: boolean } {
  const { user, profile } = useAuth()
  const byId = useEmployeeHrStore((s) => s.byId)
  const hydrated = useEmployeeHrStore((s) => s.hydrated)
  const hydrateFromCloud = useEmployeeHrStore((s) => s.hydrateFromCloud)

  // Make sure a load attempt happens even if login-time hydration didn't run yet, so the
  // page resolves to either the profile or the "not linked" state.
  useEffect(() => {
    if (!hydrated) void hydrateFromCloud()
  }, [hydrated, hydrateFromCloud])

  const email = (profile?.email || user?.email || '').trim().toLowerCase()

  return useMemo(() => {
    const list = Object.values(byId)
    const ready = hydrated || list.length > 0
    if (!email) return { employee: null, ready }
    const match = list.find((e) => (e.workEmail || '').trim().toLowerCase() === email) ?? null
    return { employee: match, ready }
  }, [byId, email, hydrated])
}
