import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { saveAppState, fetchAppState } from '@/shared/lib/cloudSync'
import { generateId } from '@/shared/lib/utils'
import type { DocumentTemplate, GeneratedDocumentRecord } from '../lib/types'
import { buildSeedTemplates } from '../lib/seedTemplates'

// Local flag so we don't re-seed the built-in templates after the user deletes them.
const SEEDED_FLAG = 'documents_seeded'

/** Cloud-wins-by-id merge for templates; keeps local-only entries. */
function mergeById(
  local: DocumentTemplate[],
  cloud: DocumentTemplate[],
): { merged: DocumentTemplate[]; hasLocalOnly: boolean } {
  const byId = new Map<string, DocumentTemplate>()
  for (const t of local) byId.set(t.id, t)
  let hasLocalOnly = false
  const cloudIds = new Set(cloud.map((t) => t.id))
  for (const t of local) if (!cloudIds.has(t.id)) hasLocalOnly = true
  for (const t of cloud) byId.set(t.id, t) // cloud wins per id
  return { merged: [...byId.values()], hasLocalOnly }
}

/** Union-by-id merge for the append-only generated-document log. */
function unionRecords(
  local: GeneratedDocumentRecord[],
  cloud: GeneratedDocumentRecord[],
): { merged: GeneratedDocumentRecord[]; hasLocalOnly: boolean } {
  const byId = new Map<string, GeneratedDocumentRecord>()
  for (const r of cloud) byId.set(r.id, r)
  let hasLocalOnly = false
  for (const r of local) {
    if (!byId.has(r.id)) { byId.set(r.id, r); hasLocalOnly = true }
  }
  const merged = [...byId.values()].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
  return { merged, hasLocalOnly }
}

interface DocumentsState {
  templates: DocumentTemplate[]
  records: GeneratedDocumentRecord[]
  /** Seed the built-in templates once (no-op if already seeded or templates exist). */
  ensureSeeded: () => void
  getTemplate: (id: string) => DocumentTemplate | undefined
  addTemplate: (input: Pick<DocumentTemplate, 'name' | 'description' | 'title' | 'body'>) => DocumentTemplate
  updateTemplate: (id: string, patch: Partial<Omit<DocumentTemplate, 'id' | 'isSystem' | 'createdAt'>>) => void
  deleteTemplate: (id: string) => void
  duplicateTemplate: (id: string) => DocumentTemplate | undefined
  /** Append generated-document records (bulk-safe). */
  addRecords: (records: GeneratedDocumentRecord[]) => void
  /** Read templates + records back from the cloud (app_state) and merge. */
  hydrateFromCloud: () => Promise<void>
}

function persistTemplates(templates: DocumentTemplate[]): void {
  storage.set(STORAGE_KEYS.DOCUMENT_TEMPLATES, templates)
  void saveAppState(STORAGE_KEYS.DOCUMENT_TEMPLATES, templates)
}

function persistRecords(records: GeneratedDocumentRecord[]): void {
  storage.set(STORAGE_KEYS.GENERATED_DOCUMENTS, records)
  void saveAppState(STORAGE_KEYS.GENERATED_DOCUMENTS, records)
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  templates: storage.get<DocumentTemplate[]>(STORAGE_KEYS.DOCUMENT_TEMPLATES) ?? [],
  records: storage.get<GeneratedDocumentRecord[]>(STORAGE_KEYS.GENERATED_DOCUMENTS) ?? [],

  ensureSeeded: () => {
    if (get().templates.length > 0) return
    if (storage.get<boolean>(SEEDED_FLAG)) return
    const seeded = buildSeedTemplates(new Date().toISOString())
    storage.set(SEEDED_FLAG, true)
    persistTemplates(seeded)
    set({ templates: seeded })
  },

  getTemplate: (id) => get().templates.find((t) => t.id === id),

  addTemplate: (input) => {
    const ts = new Date().toISOString()
    const tpl: DocumentTemplate = { id: generateId(), isSystem: false, createdAt: ts, updatedAt: ts, ...input }
    const templates = [...get().templates, tpl]
    persistTemplates(templates)
    set({ templates })
    return tpl
  },

  updateTemplate: (id, patch) => {
    const templates = get().templates.map((t) =>
      t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t,
    )
    persistTemplates(templates)
    set({ templates })
  },

  deleteTemplate: (id) => {
    const templates = get().templates.filter((t) => t.id !== id)
    persistTemplates(templates)
    set({ templates })
  },

  duplicateTemplate: (id) => {
    const src = get().templates.find((t) => t.id === id)
    if (!src) return undefined
    const ts = new Date().toISOString()
    const copy: DocumentTemplate = {
      ...src,
      id: generateId(),
      name: `${src.name} (copia)`,
      isSystem: false,
      createdAt: ts,
      updatedAt: ts,
    }
    const templates = [...get().templates, copy]
    persistTemplates(templates)
    set({ templates })
    return copy
  },

  addRecords: (records) => {
    if (records.length === 0) return
    const merged = [...records, ...get().records].sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    persistRecords(merged)
    set({ records: merged })
  },

  hydrateFromCloud: async () => {
    const [cloudTemplates, cloudRecords] = await Promise.all([
      fetchAppState<DocumentTemplate[]>(STORAGE_KEYS.DOCUMENT_TEMPLATES),
      fetchAppState<GeneratedDocumentRecord[]>(STORAGE_KEYS.GENERATED_DOCUMENTS),
    ])

    if (cloudTemplates) {
      const { merged, hasLocalOnly } = mergeById(get().templates, cloudTemplates)
      storage.set(STORAGE_KEYS.DOCUMENT_TEMPLATES, merged)
      set({ templates: merged })
      if (hasLocalOnly) void saveAppState(STORAGE_KEYS.DOCUMENT_TEMPLATES, merged)
    } else if (get().templates.length > 0) {
      void saveAppState(STORAGE_KEYS.DOCUMENT_TEMPLATES, get().templates)
    }

    if (cloudRecords) {
      const { merged, hasLocalOnly } = unionRecords(get().records, cloudRecords)
      storage.set(STORAGE_KEYS.GENERATED_DOCUMENTS, merged)
      set({ records: merged })
      if (hasLocalOnly) void saveAppState(STORAGE_KEYS.GENERATED_DOCUMENTS, merged)
    } else if (get().records.length > 0) {
      void saveAppState(STORAGE_KEYS.GENERATED_DOCUMENTS, get().records)
    }
  },
}))
