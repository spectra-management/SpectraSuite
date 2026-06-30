/**
 * Offline-first hook for the RRHH employee directory.
 *
 * Reads BambooHR credentials from the shared settings store (the same ones Nómina
 * uses), exposes the cached employees immediately, and offers a manual `sync()` that
 * re-fetches from BambooHR (read-only) and updates the localStorage-backed store.
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@/shared/hooks/useToast'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useRrhhStore } from '@/modules/rrhh/store/rrhhStore'
import { useRrhhPhotoStore } from '@/modules/rrhh/store/rrhhPhotoStore'
import { fetchRrhhDirectory } from '@/modules/rrhh/lib/connectors/bamboohr'
import { fetchAllPhotoPaths } from '@/modules/rrhh/lib/photoStorage'
import { syncBambooPhotos } from '@/modules/rrhh/lib/photoSync'
import { useRrhhAccess } from '@/modules/rrhh/lib/permissions'
import { useEmployeeHrStore } from '@/shared/store/employeeHrStore'
import type { CloudEmployee } from '@/shared/connectors/bamboohr-hr'
import type { RrhhEmployee } from '@/modules/rrhh/types'

/**
 * Map an RRHH employee (from the RRHH connector) into the shared CloudEmployee shape so a RRHH
 * sync ALSO refreshes the Documentos/HR store — the cédula + HR detail then flow to documents
 * without needing a separate Nómina sync.
 */
function toCloudEmployee(e: RrhhEmployee): CloudEmployee {
  return {
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    workEmail: e.workEmail,
    jobTitle: e.jobTitle,
    department: e.department,
    division: e.division,
    hireDate: e.hireDate,
    nationalId: e.ssn,
    address: e.address,
    city: e.city,
    state: e.state,
    zipcode: e.zipcode,
    mobilePhone: e.mobilePhone,
    workPhone: e.workPhone,
    homePhone: e.homePhone,
    dateOfBirth: e.dateOfBirth,
    gender: e.gender,
    maritalStatus: e.maritalStatus,
    nationality: e.nationality,
    supervisor: e.supervisor,
    employeeNumber: e.employeeNumber,
    payRate: e.payRate,
    payRateCurrency: e.payRateCurrency,
    payType: e.payType === 'Salary' ? 'Salary' : 'Hourly',
    status: e.status,
    country: e.country,
  }
}

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
  const { t } = useTranslation()
  const bamboohr = useSettingsStore((s) => s.bamboohr)
  const employees = useRrhhStore((s) => s.employees)
  const lastSync = useRrhhStore((s) => s.lastSync)
  const setEmployees = useRrhhStore((s) => s.setEmployees)
  const setLastSync = useRrhhStore((s) => s.setLastSync)
  const hydrateFromCloud = useRrhhStore((s) => s.hydrateFromCloud)
  const mergeFromCloud = useRrhhPhotoStore((s) => s.mergeFromCloud)
  const { canManagePhotos } = useRrhhAccess()

  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load the directory from the DB on mount, so a fresh device (e.g. a phone) shows
  // employees without first running a BambooHR sync. Best-effort; preserves local data.
  useEffect(() => { void hydrateFromCloud() }, [hydrateFromCloud])

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

      // Feed the shared Documentos/HR store so a RRHH sync also fills documents with the
      // cédula + HR detail (manual edits are preserved; best-effort cloud mirror).
      useEmployeeHrStore.getState().setFromSync(fresh.map(toCloudEmployee))

      // Persist photos to the DB in the BACKGROUND (admins only — writes need admin RLS).
      // Only changed photos are downloaded; manual uploads are never touched. Refresh the
      // override cache afterwards so the freshly-stored photos show without a reload.
      if (canManagePhotos) {
        void syncBambooPhotos(fresh, bamboohr.subdomain).then(async (result) => {
          if (result.synced > 0) {
            const map = await fetchAllPhotoPaths()
            if (map) mergeFromCloud(map)
            toast({
              variant: 'success',
              title: result.synced === 1
                ? t('rrhh.photo.syncedOne')
                : t('rrhh.photo.syncedMany', { count: result.synced }),
            })
          }
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'sync-failed')
    } finally {
      setSyncing(false)
    }
  }, [connected, bamboohr.subdomain, bamboohr.apiKey, setEmployees, setLastSync, canManagePhotos, mergeFromCloud, t])

  return { employees, lastSync, syncing, error, connected, sync }
}
