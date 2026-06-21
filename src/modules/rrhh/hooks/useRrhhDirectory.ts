/**
 * Offline-first hook for the RRHH employee directory.
 *
 * Reads BambooHR credentials from the shared settings store (the same ones Nómina
 * uses), exposes the cached employees immediately, and offers a manual `sync()` that
 * re-fetches from BambooHR (read-only) and updates the localStorage-backed store.
 */

import { useCallback, useState } from 'react'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useRrhhStore } from '@/modules/rrhh/store/rrhhStore'
import { fetchRrhhDirectory } from '@/modules/rrhh/lib/connectors/bamboohr'

export interface UseRrhhDirectory {
  employees: ReturnType<typeof useRrhhStore.getState>['employees']
  lastSync: string | null
  syncing: boolean
  error: string | null
  /** True when BambooHR credentials are configured (in Nómina → Connectors). */
  connected: boolean
  sync: () => Promise<void>
}

export function useRrhhDirectory(): UseRrhhDirectory {
  const bamboohr = useSettingsStore((s) => s.bamboohr)
  const employees = useRrhhStore((s) => s.employees)
  const lastSync = useRrhhStore((s) => s.lastSync)
  const setEmployees = useRrhhStore((s) => s.setEmployees)
  const setLastSync = useRrhhStore((s) => s.setLastSync)

  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connected = !!bamboohr.subdomain && !!bamboohr.apiKey

  const sync = useCallback(async () => {
    if (!connected) {
      setError('not-connected')
      return
    }
    setSyncing(true)
    setError(null)
    try {
      const fresh = await fetchRrhhDirectory(bamboohr.subdomain, bamboohr.apiKey)
      setEmployees(fresh)
      setLastSync(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'sync-failed')
    } finally {
      setSyncing(false)
    }
  }, [connected, bamboohr.subdomain, bamboohr.apiKey, setEmployees, setLastSync])

  return { employees, lastSync, syncing, error, connected, sync }
}
