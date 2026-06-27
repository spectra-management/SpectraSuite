import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { saveAppState, fetchAppState } from '@/shared/lib/cloudSync'
import type { SuiteModuleId } from '@/shared/lib/suiteModules'

/**
 * Suite-wide module visibility. The super admin can hide modules from everyone
 * (Suite launcher + dashboard cards). Persisted to the DB via `app_state` so the
 * choice is shared across all users; localStorage mirrors it for instant reads.
 */
interface ModuleVisibilityState {
  /** Module IDs hidden for everyone. */
  hidden: SuiteModuleId[]
  isHidden: (id: SuiteModuleId) => boolean
  /** Show or hide a module (super-admin action). Optimistic + cloud-persisted. */
  setHidden: (id: SuiteModuleId, hidden: boolean) => void
  /** Pull the shared choice from the DB on login (overwrites local mirror). */
  hydrateFromCloud: () => Promise<void>
}

const initial = storage.get<SuiteModuleId[]>(STORAGE_KEYS.MODULE_VISIBILITY) ?? []

export const useModuleVisibilityStore = create<ModuleVisibilityState>((set, get) => ({
  hidden: initial,

  isHidden: (id) => get().hidden.includes(id),

  setHidden: (id, hidden) => {
    const next = hidden
      ? [...new Set([...get().hidden, id])]
      : get().hidden.filter((m) => m !== id)
    set({ hidden: next })
    storage.set(STORAGE_KEYS.MODULE_VISIBILITY, next)
    void saveAppState(STORAGE_KEYS.MODULE_VISIBILITY, next) // shared across users
  },

  hydrateFromCloud: async () => {
    const cloud = await fetchAppState<SuiteModuleId[]>(STORAGE_KEYS.MODULE_VISIBILITY)
    if (cloud) {
      set({ hidden: cloud })
      storage.set(STORAGE_KEYS.MODULE_VISIBILITY, cloud)
    }
  },
}))
