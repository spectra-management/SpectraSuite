/**
 * Billing (facturación) store — clients, title rates, per-employee assignments,
 * and invoices. Persisted to localStorage via the shared storage abstraction
 * (designed for a later Supabase migration; see facturacion.sql).
 *
 * Audit logging is done by the CALLERS (pages) after a successful mutation, so the
 * store stays a pure data layer and the audit entry can carry user-facing context.
 */

import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { generateId } from '@/shared/lib/utils'
import type {
  BillingClient,
  TitleRate,
  ClientEmployee,
  Invoice,
  InvoiceLineItem,
  BillingMeta,
  BillingMethod,
} from '@/modules/facturacion/lib/types'
import { sumLineItems } from '@/modules/facturacion/lib/compute'
import { formatInvoiceNumber } from '@/modules/facturacion/lib/invoiceNumber'

function nowIso(): string {
  return new Date().toISOString()
}

interface BillingState {
  clients: BillingClient[]
  titleRates: TitleRate[]
  clientEmployees: ClientEmployee[]
  invoices: Invoice[]
  meta: BillingMeta

  // ── Clients ────────────────────────────────────────────────────────────────
  addClient: (data: Partial<BillingClient> & { name: string }) => BillingClient
  updateClient: (id: string, data: Partial<BillingClient>) => void
  removeClient: (id: string) => void
  getClient: (id: string) => BillingClient | undefined
  /** Auto-create one client per BambooHR division not yet present (matched by division/name). */
  ensureClientsForDivisions: (divisions: string[]) => void
  /** Auto-assign each employee to the client matching its division (idempotent); deactivates
   *  auto assignments whose employee no longer matches. Manual assignments are untouched. */
  ensureAssignmentsForDivisions: (roster: { id: string; division?: string }[]) => void
  /** Billing/invoicing is always USD: migrate any client/invoice still on another currency. */
  forceBillingCurrencyUsd: () => void

  // ── Title rates ──────────────────────────────────────────────────────────────
  upsertTitleRate: (clientId: string, title: string, baseRate: number, otRate: number) => TitleRate
  removeTitleRate: (id: string) => void
  titleRatesFor: (clientId: string) => TitleRate[]

  // ── Client employees (assignments + overrides) ───────────────────────────────
  assignEmployee: (clientId: string, employeeId: string, method?: BillingMethod | null) => ClientEmployee
  updateAssignment: (id: string, data: Partial<ClientEmployee>) => void
  removeAssignment: (id: string) => void
  assignmentsFor: (clientId: string) => ClientEmployee[]

  // ── Invoices ─────────────────────────────────────────────────────────────────
  createInvoice: (data: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Invoice
  updateInvoice: (id: string, data: Partial<Invoice>) => void
  setInvoiceLines: (id: string, lines: InvoiceLineItem[]) => void
  finalizeInvoice: (id: string) => Invoice | undefined
  removeInvoice: (id: string) => void
  getInvoice: (id: string) => Invoice | undefined
  invoicesFor: (clientId: string) => Invoice[]

  // ── Meta (remembered bonus labels) ───────────────────────────────────────────
  rememberBonusLabel: (label: string) => void
}

const loadClients = () => storage.get<BillingClient[]>(STORAGE_KEYS.BILLING_CLIENTS) ?? []
const loadTitleRates = () => storage.get<TitleRate[]>(STORAGE_KEYS.BILLING_TITLE_RATES) ?? []
const loadClientEmployees = () => storage.get<ClientEmployee[]>(STORAGE_KEYS.BILLING_CLIENT_EMPLOYEES) ?? []
const loadInvoices = () => storage.get<Invoice[]>(STORAGE_KEYS.BILLING_INVOICES) ?? []
const loadMeta = () => storage.get<BillingMeta>(STORAGE_KEYS.BILLING_META) ?? { bonusLabels: [] }

export const useBillingStore = create<BillingState>((set, get) => ({
  clients: loadClients(),
  titleRates: loadTitleRates(),
  clientEmployees: loadClientEmployees(),
  invoices: loadInvoices(),
  meta: loadMeta(),

  // ── Clients ────────────────────────────────────────────────────────────────
  addClient: (data) => {
    const ts = nowIso()
    const client: BillingClient = {
      id: generateId(),
      name: data.name,
      division: data.division ?? '',
      contactName: data.contactName ?? '',
      contactEmail: data.contactEmail ?? '',
      contactPhone: data.contactPhone ?? '',
      billingAddress: data.billingAddress ?? '',
      remitToName: data.remitToName ?? '',
      remitToAddress: data.remitToAddress ?? '',
      remitToDetails: data.remitToDetails ?? '',
      invoicePrefix: (data.invoicePrefix ?? 'INV').toUpperCase(),
      nextInvoiceSeq: data.nextInvoiceSeq ?? 1,
      defaultMethod: data.defaultMethod ?? 'hour',
      // Billing/invoicing is always in USD.
      currencyCountry: data.currencyCountry ?? 'United States',
      notes: data.notes ?? '',
      active: data.active ?? true,
      createdAt: ts,
      updatedAt: ts,
    }
    const clients = [...get().clients, client]
    storage.set(STORAGE_KEYS.BILLING_CLIENTS, clients)
    set({ clients })
    return client
  },

  updateClient: (id, data) => {
    const clients = get().clients.map((c) =>
      c.id === id ? { ...c, ...data, updatedAt: nowIso() } : c,
    )
    storage.set(STORAGE_KEYS.BILLING_CLIENTS, clients)
    set({ clients })
  },

  removeClient: (id) => {
    const clients = get().clients.filter((c) => c.id !== id)
    const titleRates = get().titleRates.filter((r) => r.clientId !== id)
    const clientEmployees = get().clientEmployees.filter((a) => a.clientId !== id)
    storage.set(STORAGE_KEYS.BILLING_CLIENTS, clients)
    storage.set(STORAGE_KEYS.BILLING_TITLE_RATES, titleRates)
    storage.set(STORAGE_KEYS.BILLING_CLIENT_EMPLOYEES, clientEmployees)
    set({ clients, titleRates, clientEmployees })
  },

  getClient: (id) => get().clients.find((c) => c.id === id),

  ensureClientsForDivisions: (divisions) => {
    const existing = get().clients
    const known = new Set(
      existing.map((c) => (c.division || c.name).trim().toLowerCase()).filter(Boolean),
    )
    const wanted = [...new Set(divisions.map((d) => d.trim()).filter(Boolean))]
    const toCreate = wanted.filter((d) => !known.has(d.toLowerCase()))
    if (toCreate.length === 0) return
    const ts = nowIso()
    const created: BillingClient[] = toCreate.map((name) => ({
      id: generateId(),
      name,
      division: name,
      contactName: '', contactEmail: '', contactPhone: '',
      billingAddress: '', remitToName: '', remitToAddress: '', remitToDetails: '',
      invoicePrefix: 'INV', nextInvoiceSeq: 1,
      defaultMethod: 'hour', currencyCountry: 'United States',
      notes: '', active: true, createdAt: ts, updatedAt: ts,
    }))
    const clients = [...existing, ...created]
    storage.set(STORAGE_KEYS.BILLING_CLIENTS, clients)
    set({ clients })
  },

  ensureAssignmentsForDivisions: (roster) => {
    const clientByTarget = new Map<string, BillingClient>()
    for (const c of get().clients) {
      const key = (c.division || c.name).trim().toLowerCase()
      if (key && !clientByTarget.has(key)) clientByTarget.set(key, c)
    }
    const ts = nowIso()
    let next = get().clientEmployees
    const byPair = new Map(next.map((a) => [`${a.clientId}:${a.employeeId}`, a]))
    const desired = new Set<string>()
    let changed = false

    // Create / re-activate an auto assignment for each employee → its division's client.
    for (const e of roster) {
      const div = (e.division ?? '').trim().toLowerCase()
      if (!div) continue
      const client = clientByTarget.get(div)
      if (!client) continue
      const pair = `${client.id}:${e.id}`
      desired.add(pair)
      const ex = byPair.get(pair)
      if (!ex) {
        next = [...next, {
          id: generateId(), clientId: client.id, employeeId: e.id,
          method: null, baseRateOverride: null, otRateOverride: null,
          fixedAmount: null, percentageRate: null, active: true, auto: true,
          createdAt: ts, updatedAt: ts,
        }]
        changed = true
      } else if (ex.auto && !ex.active) {
        next = next.map((a) => (a.id === ex.id ? { ...a, active: true, updatedAt: ts } : a))
        changed = true
      }
    }
    // Deactivate auto assignments whose employee no longer matches (moved client / lost division).
    for (const a of get().clientEmployees) {
      if (a.auto && a.active && !desired.has(`${a.clientId}:${a.employeeId}`)) {
        next = next.map((x) => (x.id === a.id ? { ...x, active: false, updatedAt: ts } : x))
        changed = true
      }
    }
    if (!changed) return
    storage.set(STORAGE_KEYS.BILLING_CLIENT_EMPLOYEES, next)
    set({ clientEmployees: next })
  },

  forceBillingCurrencyUsd: () => {
    const USD = 'United States'
    const ts = nowIso()
    let changed = false
    const clients = get().clients.map((c) => {
      if (c.currencyCountry === USD) return c
      changed = true
      return { ...c, currencyCountry: USD, updatedAt: ts }
    })
    const invoices = get().invoices.map((i) => {
      if (i.currencyCountry === USD) return i
      changed = true
      return { ...i, currencyCountry: USD }
    })
    if (!changed) return
    storage.set(STORAGE_KEYS.BILLING_CLIENTS, clients)
    storage.set(STORAGE_KEYS.BILLING_INVOICES, invoices)
    set({ clients, invoices })
  },

  // ── Title rates ──────────────────────────────────────────────────────────────
  upsertTitleRate: (clientId, title, baseRate, otRate) => {
    const existing = get().titleRates.find(
      (r) => r.clientId === clientId && r.title.trim().toLowerCase() === title.trim().toLowerCase(),
    )
    const ts = nowIso()
    let row: TitleRate
    let titleRates: TitleRate[]
    if (existing) {
      row = { ...existing, baseRate, otRate, updatedAt: ts }
      titleRates = get().titleRates.map((r) => (r.id === existing.id ? row : r))
    } else {
      row = { id: generateId(), clientId, title: title.trim(), baseRate, otRate, createdAt: ts, updatedAt: ts }
      titleRates = [...get().titleRates, row]
    }
    storage.set(STORAGE_KEYS.BILLING_TITLE_RATES, titleRates)
    set({ titleRates })
    return row
  },

  removeTitleRate: (id) => {
    const titleRates = get().titleRates.filter((r) => r.id !== id)
    storage.set(STORAGE_KEYS.BILLING_TITLE_RATES, titleRates)
    set({ titleRates })
  },

  titleRatesFor: (clientId) => get().titleRates.filter((r) => r.clientId === clientId),

  // ── Client employees ─────────────────────────────────────────────────────────
  assignEmployee: (clientId, employeeId, method = null) => {
    const existing = get().clientEmployees.find(
      (a) => a.clientId === clientId && a.employeeId === employeeId,
    )
    if (existing) {
      // Re-activate instead of duplicating.
      if (!existing.active) get().updateAssignment(existing.id, { active: true })
      return existing
    }
    const ts = nowIso()
    const assignment: ClientEmployee = {
      id: generateId(),
      clientId,
      employeeId,
      method,
      baseRateOverride: null,
      otRateOverride: null,
      fixedAmount: null,
      percentageRate: null,
      active: true,
      createdAt: ts,
      updatedAt: ts,
    }
    const clientEmployees = [...get().clientEmployees, assignment]
    storage.set(STORAGE_KEYS.BILLING_CLIENT_EMPLOYEES, clientEmployees)
    set({ clientEmployees })
    return assignment
  },

  updateAssignment: (id, data) => {
    const clientEmployees = get().clientEmployees.map((a) =>
      a.id === id ? { ...a, ...data, updatedAt: nowIso() } : a,
    )
    storage.set(STORAGE_KEYS.BILLING_CLIENT_EMPLOYEES, clientEmployees)
    set({ clientEmployees })
  },

  removeAssignment: (id) => {
    const clientEmployees = get().clientEmployees.filter((a) => a.id !== id)
    storage.set(STORAGE_KEYS.BILLING_CLIENT_EMPLOYEES, clientEmployees)
    set({ clientEmployees })
  },

  assignmentsFor: (clientId) => get().clientEmployees.filter((a) => a.clientId === clientId),

  // ── Invoices ─────────────────────────────────────────────────────────────────
  createInvoice: (data) => {
    const ts = nowIso()
    const invoice: Invoice = {
      ...data,
      subtotal: sumLineItems(data.lineItems),
      total: sumLineItems(data.lineItems),
      id: generateId(),
      createdAt: ts,
      updatedAt: ts,
    }
    const invoices = [...get().invoices, invoice]
    storage.set(STORAGE_KEYS.BILLING_INVOICES, invoices)
    set({ invoices })
    return invoice
  },

  updateInvoice: (id, data) => {
    const invoices = get().invoices.map((inv) =>
      inv.id === id ? { ...inv, ...data, updatedAt: nowIso() } : inv,
    )
    storage.set(STORAGE_KEYS.BILLING_INVOICES, invoices)
    set({ invoices })
  },

  setInvoiceLines: (id, lines) => {
    const subtotal = sumLineItems(lines)
    const invoices = get().invoices.map((inv) =>
      inv.id === id ? { ...inv, lineItems: lines, subtotal, total: subtotal, updatedAt: nowIso() } : inv,
    )
    storage.set(STORAGE_KEYS.BILLING_INVOICES, invoices)
    set({ invoices })
  },

  finalizeInvoice: (id) => {
    const invoice = get().invoices.find((inv) => inv.id === id)
    if (!invoice || invoice.status === 'finalized') return invoice
    const client = get().clients.find((c) => c.id === invoice.clientId)
    if (!client) return undefined

    const seq = client.nextInvoiceSeq
    const number = formatInvoiceNumber(client.invoicePrefix, seq)
    const ts = nowIso()
    const subtotal = sumLineItems(invoice.lineItems)

    const invoices = get().invoices.map((inv) =>
      inv.id === id
        ? {
            ...inv,
            status: 'finalized' as const,
            number,
            subtotal,
            total: subtotal,
            finalizedAt: ts,
            updatedAt: ts,
            clientNameSnapshot: client.name,
          }
        : inv,
    )
    // Advance the client's sequence counter atomically with the finalize.
    const clients = get().clients.map((c) =>
      c.id === client.id ? { ...c, nextInvoiceSeq: seq + 1, updatedAt: ts } : c,
    )
    storage.set(STORAGE_KEYS.BILLING_INVOICES, invoices)
    storage.set(STORAGE_KEYS.BILLING_CLIENTS, clients)
    set({ invoices, clients })
    return invoices.find((inv) => inv.id === id)
  },

  removeInvoice: (id) => {
    const invoices = get().invoices.filter((inv) => inv.id !== id)
    storage.set(STORAGE_KEYS.BILLING_INVOICES, invoices)
    set({ invoices })
  },

  getInvoice: (id) => get().invoices.find((inv) => inv.id === id),

  invoicesFor: (clientId) => get().invoices.filter((inv) => inv.clientId === clientId),

  // ── Meta ───────────────────────────────────────────────────────────────────
  rememberBonusLabel: (label) => {
    const clean = label.trim()
    if (!clean) return
    const existing = get().meta.bonusLabels
    if (existing.some((l) => l.toLowerCase() === clean.toLowerCase())) return
    const meta = { ...get().meta, bonusLabels: [clean, ...existing].slice(0, 30) }
    storage.set(STORAGE_KEYS.BILLING_META, meta)
    set({ meta })
  },
}))
