/**
 * Offline-first hook for RRHH time-off (Vacation/PTO), read-only.
 * See connector note: the shared proxy filters time-off to BambooHR Vacation (type 83).
 */

import { useCallback, useState } from 'react'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useRrhhStore } from '@/modules/rrhh/store/rrhhStore'
import { fetchRrhhTimeOff } from '@/modules/rrhh/lib/connectors/bamboohr'

export interface UseRrhhTimeOff {
  timeOff: ReturnType<typeof useRrhhStore.getState>['timeOff']
  year: number | null
  syncing: boolean
  error: string | null
  connected: boolean
  sync: (year: number) => Promise<void>
}

export function useRrhhTimeOff(): UseRrhhTimeOff {
  const bamboohr = useSettingsStore((s) => s.bamboohr)
  const timeOff = useRrhhStore((s) => s.timeOff)
  const year = useRrhhStore((s) => s.timeOffYear)
  const setTimeOff = useRrhhStore((s) => s.setTimeOff)

  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connected = !!bamboohr.subdomain && !!bamboohr.apiKey

  const sync = useCallback(
    async (targetYear: number) => {
      if (!connected) {
        setError('not-connected')
        return
      }
      setSyncing(true)
      setError(null)
      try {
        const fresh = await fetchRrhhTimeOff(bamboohr.subdomain, bamboohr.apiKey, targetYear)
        setTimeOff(fresh, targetYear)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'sync-failed')
      } finally {
        setSyncing(false)
      }
    },
    [connected, bamboohr.subdomain, bamboohr.apiKey, setTimeOff],
  )

  return { timeOff, year, syncing, error, connected, sync }
}
