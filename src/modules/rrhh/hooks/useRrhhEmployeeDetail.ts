/**
 * Per-employee detail hooks for the profile tabs (read-only).
 *
 * Unlike the directory (which is offline-first via the module store), these tabs fetch
 * on demand when opened: emergency contacts, compensation history, and document
 * metadata each come from a per-employee BambooHR endpoint. Each hook owns its own
 * loading/error state so one failing tab never breaks the rest of the profile.
 *
 * `enabled` lets the caller defer the fetch until the tab is actually shown (and, for
 * sensitive tabs, until the permission check passes).
 */

import { useEffect, useState } from 'react'
import { useSettingsStore } from '@/shared/store/settingsStore'
import {
  fetchRrhhEmergencyContacts,
  fetchRrhhCompensation,
  fetchRrhhDocuments,
} from '@/modules/rrhh/lib/connectors/bamboohr'
import type {
  RrhhEmergencyContact,
  RrhhCompensationEntry,
  RrhhDocument,
} from '@/modules/rrhh/types'

interface AsyncState<T> {
  data: T
  loading: boolean
  error: string | null
  connected: boolean
}

function useEmployeeResource<T>(
  fetcher: (subdomain: string, apiKey: string, id: string) => Promise<T>,
  empty: T,
  employeeId: string | undefined,
  enabled: boolean,
): AsyncState<T> {
  const bamboohr = useSettingsStore((s) => s.bamboohr)
  const connected = !!bamboohr.subdomain && !!bamboohr.apiKey

  const [data, setData] = useState<T>(empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !connected || !employeeId) return
    let active = true
    setLoading(true)
    setError(null)
    fetcher(bamboohr.subdomain, bamboohr.apiKey, employeeId)
      .then((fresh) => {
        if (active) setData(fresh)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'fetch-failed')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, connected, employeeId, bamboohr.subdomain, bamboohr.apiKey])

  return { data, loading, error, connected }
}

export function useRrhhEmergencyContacts(employeeId: string | undefined, enabled: boolean) {
  return useEmployeeResource<RrhhEmergencyContact[]>(
    fetchRrhhEmergencyContacts,
    [],
    employeeId,
    enabled,
  )
}

export function useRrhhCompensation(employeeId: string | undefined, enabled: boolean) {
  return useEmployeeResource<RrhhCompensationEntry[]>(
    fetchRrhhCompensation,
    [],
    employeeId,
    enabled,
  )
}

export function useRrhhDocuments(employeeId: string | undefined, enabled: boolean) {
  return useEmployeeResource<RrhhDocument[]>(fetchRrhhDocuments, [], employeeId, enabled)
}
