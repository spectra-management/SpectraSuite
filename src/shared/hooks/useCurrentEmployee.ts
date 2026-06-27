import { useMemo } from 'react'
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
 *  - `ready` is false until the directory has loaded at least once, so callers can show a
 *    loading state instead of a premature "no profile" message.
 */
export function useCurrentEmployee(): { employee: CloudEmployee | null; ready: boolean } {
  const { user, profile } = useAuth()
  const byId = useEmployeeHrStore((s) => s.byId)

  const email = (profile?.email || user?.email || '').trim().toLowerCase()

  return useMemo(() => {
    const list = Object.values(byId)
    const ready = list.length > 0
    if (!email) return { employee: null, ready }
    const match = list.find((e) => (e.workEmail || '').trim().toLowerCase() === email) ?? null
    return { employee: match, ready }
  }, [byId, email])
}
