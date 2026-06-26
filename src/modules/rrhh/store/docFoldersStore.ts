import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { saveAppState, fetchAppState } from '@/shared/lib/cloudSync'

/**
 * App-local document folders for RRHH, layered OVER BambooHR (never writes to BambooHR).
 * Per employee: the custom folders the user created + per-document folder moves (fileId →
 * folder name). A document's effective folder is its move override, else its BambooHR category.
 * Offline-first: localStorage cache + Supabase app_state (migration 010) read back on login.
 */
export interface EmployeeDocFolders {
  /** Custom folder names the user created for this employee. */
  folders: string[]
  /** BambooHR fileId → folder name the user moved it to. */
  moves: Record<string, string>
}

type FoldersMap = Record<string, EmployeeDocFolders>
const EMPTY: EmployeeDocFolders = { folders: [], moves: {} }

interface DocFoldersState {
  byEmployee: FoldersMap
  hydrated: boolean
  get: (employeeId: string) => EmployeeDocFolders
  addFolder: (employeeId: string, name: string) => void
  moveDoc: (employeeId: string, fileId: string, folder: string) => void
  hydrateFromCloud: () => Promise<void>
}

function persist(byEmployee: FoldersMap) {
  storage.set(STORAGE_KEYS.RRHH_DOC_FOLDERS, byEmployee)
  void saveAppState(STORAGE_KEYS.RRHH_DOC_FOLDERS, byEmployee)
}

export const useDocFoldersStore = create<DocFoldersState>((set, get) => ({
  byEmployee: storage.get<FoldersMap>(STORAGE_KEYS.RRHH_DOC_FOLDERS) ?? {},
  hydrated: false,

  get: (employeeId) => get().byEmployee[employeeId] ?? EMPTY,

  addFolder: (employeeId, name) => {
    const folder = name.trim()
    if (!folder) return
    const cur = get().byEmployee[employeeId] ?? EMPTY
    if (cur.folders.includes(folder)) return
    const byEmployee = { ...get().byEmployee, [employeeId]: { ...cur, folders: [...cur.folders, folder] } }
    set({ byEmployee })
    persist(byEmployee)
  },

  moveDoc: (employeeId, fileId, folder) => {
    const cur = get().byEmployee[employeeId] ?? EMPTY
    const moves = { ...cur.moves }
    if (folder) moves[fileId] = folder
    else delete moves[fileId] // empty folder = revert to the BambooHR category
    const byEmployee = { ...get().byEmployee, [employeeId]: { ...cur, moves } }
    set({ byEmployee })
    persist(byEmployee)
  },

  hydrateFromCloud: async () => {
    const cloud = await fetchAppState<FoldersMap>(STORAGE_KEYS.RRHH_DOC_FOLDERS)
    if (cloud) {
      storage.set(STORAGE_KEYS.RRHH_DOC_FOLDERS, cloud)
      set({ byEmployee: cloud, hydrated: true })
    } else {
      set({ hydrated: true })
    }
  },
}))
