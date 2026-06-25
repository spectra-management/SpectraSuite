import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { saveAppState, fetchAppState } from '@/shared/lib/cloudSync'
import { generateId } from '@/shared/lib/utils'
import type { DocumentTemplate, GeneratedDocumentRecord } from '../lib/types'
import { buildSeedTemplates } from '../lib/seedTemplates'

// Workspace-level "templates were seeded once" marker. Synced to the cloud (not just
// localStorage) so a fresh device / cleared cache does NOT re-seed templates that were
// already seeded — and possibly deleted — elsewhere.
const SEEDED_FLAG = 'documents_seeded'

/** Union-by-id merge for the append-only generated-document log (cloud + local). */
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
  getTemplate: (id: string) => DocumentTemplate | undefined
  addTemplate: (input: Pick<DocumentTemplate, 'name' | 'description' | 'title' | 'body'>) => DocumentTemplate
  updateTemplate: (id: string, patch: Partial<Omit<DocumentTemplate, 'id' | 'isSystem' | 'createdAt'>>) => void
  deleteTemplate: (id: string) => void
  /** Duplicate a template; `copySuffix` is the translated word appended to the name. */
  duplicateTemplate: (id: string, copySuffix: string) => DocumentTemplate | undefined
  /** Append generated-document records (bulk-safe). */
  addRecords: (records: GeneratedDocumentRecord[]) => void
  /**
   * Seed (once per workspace) + read templates/records back from the cloud. Cloud is
   * authoritative: deleted built-in templates are NOT re-introduced, while local-only
   * user templates are preserved and pushed up. Offline-safe (cloud null → local kept).
   */
  initialize: () => Promise<void>
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

  duplicateTemplate: (id, copySuffix) => {
    const src = get().templates.find((t) => t.id === id)
    if (!src) return undefined
    const ts = new Date().toISOString()
    const copy: DocumentTemplate = {
      ...src,
      id: generateId(),
      name: `${src.name} (${copySuffix})`,
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

  initialize: async () => {
    const [cloudTemplates, cloudRecords, cloudSeeded] = await Promise.all([
      fetchAppState<DocumentTemplate[]>(STORAGE_KEYS.DOCUMENT_TEMPLATES),
      fetchAppState<GeneratedDocumentRecord[]>(STORAGE_KEYS.GENERATED_DOCUMENTS),
      fetchAppState<boolean>(SEEDED_FLAG),
    ])

    // ── Templates ──────────────────────────────────────────────────────────────
    if (cloudTemplates) {
      // Cloud is authoritative: take its set, keeping only local-only USER templates
      // (never re-add a built-in template the cloud deliberately lacks = deleted elsewhere).
      const cloudIds = new Set(cloudTemplates.map((t) => t.id))
      const localOnlyUser = get().templates.filter((t) => !t.isSystem && !cloudIds.has(t.id))
      const merged = [...cloudTemplates, ...localOnlyUser]
      storage.set(STORAGE_KEYS.DOCUMENT_TEMPLATES, merged)
      set({ templates: merged })
      if (localOnlyUser.length > 0) void saveAppState(STORAGE_KEYS.DOCUMENT_TEMPLATES, merged)
    } else {
      // No cloud copy yet. Seed only if this workspace was never seeded (locally or in cloud).
      const seeded = !!storage.get<boolean>(SEEDED_FLAG) || cloudSeeded === true
      let templates = get().templates
      if (templates.length === 0 && !seeded) {
        templates = buildSeedTemplates(new Date().toISOString())
        storage.set(STORAGE_KEYS.DOCUMENT_TEMPLATES, templates)
        set({ templates })
      }
      if (templates.length > 0 || seeded) {
        storage.set(SEEDED_FLAG, true)
        void saveAppState(SEEDED_FLAG, true)
        if (templates.length > 0) void saveAppState(STORAGE_KEYS.DOCUMENT_TEMPLATES, templates)
      }
    }

    // ── Generated-document records ───────────────────────────────────────────────
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
