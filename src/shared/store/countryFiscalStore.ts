import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { saveAppState, fetchAppState } from '@/shared/lib/cloudSync'
import type { CountryFiscalConfig } from '@/shared/types'
import { COUNTRY_FISCAL_DEFAULTS } from '@/shared/lib/countryFiscalDefaults'

/**
 * Per-country fiscal configs (employee statutory deductions + income tax), editable in
 * Nómina → Settings → Country taxes. Each country is seeded from researched defaults; user
 * edits override per country. Offline-first cloud-authoritative: localStorage cache + Supabase
 * app_state (migration 010) read back on login. The Dominican Republic is NOT here — it keeps
 * its dedicated Fiscal Parameters path.
 */
type ConfigMap = Record<string, CountryFiscalConfig>

interface CountryFiscalState {
  /** Merged map: researched defaults overlaid with the user's saved edits. */
  byCountry: ConfigMap
  /** Replace one country's config (persists locally + to the cloud). */
  setConfig: (key: string, config: CountryFiscalConfig) => void
  /** Restore one country to its researched default. */
  resetConfig: (key: string) => void
  hydrateFromCloud: () => Promise<void>
}

/** Defaults overlaid with any stored edits (stored wins; new default countries still appear). */
function merge(stored: ConfigMap | null): ConfigMap {
  return { ...COUNTRY_FISCAL_DEFAULTS, ...(stored ?? {}) }
}

export const useCountryFiscalStore = create<CountryFiscalState>((set, get) => ({
  byCountry: merge(storage.get<ConfigMap>(STORAGE_KEYS.COUNTRY_FISCAL)),

  setConfig: (key, config) => {
    const byCountry = { ...get().byCountry, [key]: config }
    storage.set(STORAGE_KEYS.COUNTRY_FISCAL, byCountry)
    set({ byCountry })
    void saveAppState(STORAGE_KEYS.COUNTRY_FISCAL, byCountry)
  },

  resetConfig: (key) => {
    const byCountry = { ...get().byCountry }
    if (COUNTRY_FISCAL_DEFAULTS[key]) byCountry[key] = COUNTRY_FISCAL_DEFAULTS[key]
    else delete byCountry[key]
    storage.set(STORAGE_KEYS.COUNTRY_FISCAL, byCountry)
    set({ byCountry })
    void saveAppState(STORAGE_KEYS.COUNTRY_FISCAL, byCountry)
  },

  hydrateFromCloud: async () => {
    const cloud = await fetchAppState<ConfigMap>(STORAGE_KEYS.COUNTRY_FISCAL)
    if (!cloud) return // unreachable / not saved yet — keep local cache
    const byCountry = merge(cloud)
    storage.set(STORAGE_KEYS.COUNTRY_FISCAL, byCountry)
    set({ byCountry })
  },
}))
