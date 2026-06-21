/**
 * RRHH module store (offline-first).
 *
 * Mirrors the Nómina `employeesStore` pattern: Zustand + the shared `storage`
 * abstraction (localStorage today, Supabase-ready) + a `lastSync` marker + a manual
 * sync action. Module-local on purpose — it is only imported within `modules/rrhh`,
 * so module isolation (IMPORT_RULES) holds.
 */

import { create } from 'zustand'
import { storage } from '@/shared/lib/storage'
import type { RrhhEmployee, RrhhTimeOffRequest } from '@/modules/rrhh/types'

const KEY_EMPLOYEES = 'rrhh_employees'
const KEY_TIMEOFF = 'rrhh_timeoff'
const KEY_LAST_SYNC = 'rrhh_last_sync'
const KEY_TIMEOFF_YEAR = 'rrhh_timeoff_year'

interface RrhhState {
  employees: RrhhEmployee[]
  timeOff: RrhhTimeOffRequest[]
  timeOffYear: number | null
  lastSync: string | null

  setEmployees: (employees: RrhhEmployee[]) => void
  setTimeOff: (requests: RrhhTimeOffRequest[], year: number) => void
  setLastSync: (iso: string) => void
}

export const useRrhhStore = create<RrhhState>((set) => ({
  employees: storage.get<RrhhEmployee[]>(KEY_EMPLOYEES) ?? [],
  timeOff: storage.get<RrhhTimeOffRequest[]>(KEY_TIMEOFF) ?? [],
  timeOffYear: storage.get<number>(KEY_TIMEOFF_YEAR),
  lastSync: storage.get<string>(KEY_LAST_SYNC),

  setEmployees: (employees) => {
    storage.set(KEY_EMPLOYEES, employees)
    set({ employees })
  },

  setTimeOff: (requests, year) => {
    storage.set(KEY_TIMEOFF, requests)
    storage.set(KEY_TIMEOFF_YEAR, year)
    set({ timeOff: requests, timeOffYear: year })
  },

  setLastSync: (iso) => {
    storage.set(KEY_LAST_SYNC, iso)
    set({ lastSync: iso })
  },
}))
