import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { DEFAULT_FISCAL_PARAMETERS, DEFAULT_PAYROLL_SETTINGS, DEFAULT_NIGHT_SHIFT_SETTINGS } from '@/shared/lib/payroll-defaults'
import {
  saveCompanySettings,
  saveBambooIntegration,
  saveHubstaffIntegration,
  fetchCompanySettings,
  fetchConnectorConfigs,
  saveAppState,
  fetchAppState,
} from '@/shared/lib/cloudSync'
import { applyBambooCloud, applyHubstaffCloud } from '@/shared/lib/cloudMerge'
import type {
  AppSettings,
  BambooHRConfig,
  CompanySettings,
  EmailConfig,
  EmailTemplate,
  FiscalParameters,
  HubstaffConfig,
  PayrollSettings,
  NightShiftSettings,
} from '@/shared/types'

const defaultCompany: CompanySettings = {
  name: 'My Company',
  rnc: '',
  address: '',
  phone: '',
  email: '',
  accentColor: '#059669',
  secondaryColor: '#065F46',
}

const defaultBambooHR: BambooHRConfig = {
  subdomain: '',
  apiKey: '',
  connected: false,
}

const defaultHubstaff: HubstaffConfig = {
  refreshToken: '',
  organizationId: '',
  connected: false,
  employeeMapping: [],
}

const defaultEmail: EmailConfig = {
  provider: 'resend',
  fromName: '',
  fromEmail: '',
  connected: false,
}

const defaultEmailTemplate: EmailTemplate = {
  subject: 'Pay Stub - {period} | {company}',
  body: 'Dear {name},\n\nPlease find attached your pay stub for the period {period}.\n\nBest regards,\n{company}',
  payStubLanguage: 'es',
}

interface SettingsState extends AppSettings {
  updateCompany: (data: Partial<CompanySettings>) => void
  hydrateCompanyFromCloud: () => Promise<void>
  hydrateConnectorsFromCloud: () => Promise<void>
  /** Read fiscal/payroll/night/email settings back from the cloud (shared across users). */
  hydrateSettingsFromCloud: () => Promise<void>
  updatePayrollSettings: (data: Partial<PayrollSettings>) => void
  updateNightShift: (data: Partial<NightShiftSettings>) => void
  updateFiscalParameters: (data: Partial<FiscalParameters>) => void
  resetFiscalParameters: () => void
  updateBambooHR: (data: Partial<BambooHRConfig>) => void
  updateHubstaff: (data: Partial<HubstaffConfig>) => void
  updateEmailConfig: (data: Partial<EmailConfig>) => void
  updateEmailTemplate: (data: Partial<EmailTemplate>) => void
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  company: { ...defaultCompany, ...(storage.get<CompanySettings>(STORAGE_KEYS.COMPANY) ?? {}) },
  payroll: storage.get<PayrollSettings>(STORAGE_KEYS.PAYROLL_SETTINGS) ?? DEFAULT_PAYROLL_SETTINGS,
  nightShift: { ...DEFAULT_NIGHT_SHIFT_SETTINGS, ...(storage.get<NightShiftSettings>(STORAGE_KEYS.NIGHT_SETTINGS) ?? {}) },
  fiscal: storage.get<FiscalParameters>(STORAGE_KEYS.FISCAL_PARAMETERS) ?? DEFAULT_FISCAL_PARAMETERS,
  bamboohr: storage.get<BambooHRConfig>(STORAGE_KEYS.BAMBOOHR_CONFIG) ?? defaultBambooHR,
  hubstaff: (() => {
    const raw = storage.get<Record<string, unknown>>(STORAGE_KEYS.HUBSTAFF_CONFIG)
    if (!raw) return defaultHubstaff
    // Migrate: field was renamed accessToken → refreshToken in commit ac715042.
    // Old localStorage data has { accessToken: '...' } with no refreshToken key.
    const needsMigration = !raw.refreshToken && !!raw.accessToken
    const refreshToken =
      (raw.refreshToken as string | undefined) ||
      (raw.accessToken as string | undefined) ||
      ''
    const migrated = { ...defaultHubstaff, ...raw, refreshToken } as HubstaffConfig
    if (needsMigration) storage.set(STORAGE_KEYS.HUBSTAFF_CONFIG, migrated)
    return migrated
  })(),
  email: storage.get<EmailConfig>(STORAGE_KEYS.EMAIL_CONFIG) ?? defaultEmail,
  emailTemplate: storage.get<EmailTemplate>(STORAGE_KEYS.EMAIL_TEMPLATE) ?? defaultEmailTemplate,

  updateCompany: (data) => {
    const updated = { ...get().company, ...data }
    storage.set(STORAGE_KEYS.COMPANY, updated)
    set({ company: updated })
    void saveCompanySettings(updated)  // best-effort cloud mirror
  },

  // Hydrate company settings from Supabase (cloud is authoritative when present),
  // keeping localStorage as the offline cache. Called after auth resolves.
  hydrateCompanyFromCloud: async () => {
    const cloud = await fetchCompanySettings()
    if (!cloud) return
    const merged = { ...get().company, ...Object.fromEntries(Object.entries(cloud).filter(([, v]) => v != null)) }
    storage.set(STORAGE_KEYS.COMPANY, merged)
    set({ company: merged })
  },

  // Restore connector credentials (BambooHR/Hubstaff) from Supabase on login, so a
  // deploy, domain change, new device, or localStorage clear no longer drops the
  // connection. Cloud wins for the durable fields; local-only runtime fields
  // (employeeMapping, cached access token) are preserved. If the cloud has NO row but
  // we have a local credential, push it up once (best-effort migration of existing data).
  hydrateConnectorsFromCloud: async () => {
    const { bamboohr, hubstaff } = await fetchConnectorConfigs()

    if (bamboohr) {
      const merged = applyBambooCloud(get().bamboohr, bamboohr)
      storage.set(STORAGE_KEYS.BAMBOOHR_CONFIG, merged)
      set({ bamboohr: merged })
    } else if (get().bamboohr.apiKey || get().bamboohr.connected) {
      void saveBambooIntegration(get().bamboohr)
    }

    if (hubstaff) {
      const merged = applyHubstaffCloud(get().hubstaff, hubstaff)
      storage.set(STORAGE_KEYS.HUBSTAFF_CONFIG, merged)
      set({ hubstaff: merged })
    } else if (get().hubstaff.refreshToken || get().hubstaff.connected) {
      void saveHubstaffIntegration(get().hubstaff)
    }
  },

  updatePayrollSettings: (data) => {
    const updated = { ...get().payroll, ...data }
    storage.set(STORAGE_KEYS.PAYROLL_SETTINGS, updated)
    set({ payroll: updated })
    void saveAppState(STORAGE_KEYS.PAYROLL_SETTINGS, updated)  // shared across users
  },

  updateNightShift: (data) => {
    const updated = { ...get().nightShift, ...data }
    storage.set(STORAGE_KEYS.NIGHT_SETTINGS, updated)
    set({ nightShift: updated })
    void saveAppState(STORAGE_KEYS.NIGHT_SETTINGS, updated)
  },

  updateFiscalParameters: (data) => {
    const updated = { ...get().fiscal, ...data }
    storage.set(STORAGE_KEYS.FISCAL_PARAMETERS, updated)
    set({ fiscal: updated })
    void saveAppState(STORAGE_KEYS.FISCAL_PARAMETERS, updated)
  },

  resetFiscalParameters: () => {
    storage.set(STORAGE_KEYS.FISCAL_PARAMETERS, DEFAULT_FISCAL_PARAMETERS)
    set({ fiscal: DEFAULT_FISCAL_PARAMETERS })
    void saveAppState(STORAGE_KEYS.FISCAL_PARAMETERS, DEFAULT_FISCAL_PARAMETERS)
  },

  updateBambooHR: (data) => {
    const updated = { ...get().bamboohr, ...data }
    storage.set(STORAGE_KEYS.BAMBOOHR_CONFIG, updated)
    set({ bamboohr: updated })
    void saveBambooIntegration(updated)  // best-effort cloud mirror
  },

  updateHubstaff: (data) => {
    const updated = { ...get().hubstaff, ...data }
    storage.set(STORAGE_KEYS.HUBSTAFF_CONFIG, updated)
    set({ hubstaff: updated })
    void saveHubstaffIntegration(updated)  // best-effort cloud mirror
  },

  updateEmailConfig: (data) => {
    const updated = { ...get().email, ...data }
    storage.set(STORAGE_KEYS.EMAIL_CONFIG, updated)
    set({ email: updated })
    void saveAppState(STORAGE_KEYS.EMAIL_CONFIG, updated)
  },

  updateEmailTemplate: (data) => {
    const updated = { ...get().emailTemplate, ...data }
    storage.set(STORAGE_KEYS.EMAIL_TEMPLATE, updated)
    set({ emailTemplate: updated })
    void saveAppState(STORAGE_KEYS.EMAIL_TEMPLATE, updated)
  },

  // Read fiscal/payroll/night/email settings from app_state (shared, cloud-authoritative).
  // Best-effort + offline-safe: any missing/unreadable key keeps the localStorage cache.
  hydrateSettingsFromCloud: async () => {
    const [payroll, nightShift, fiscal, email, emailTemplate] = await Promise.all([
      fetchAppState<PayrollSettings>(STORAGE_KEYS.PAYROLL_SETTINGS),
      fetchAppState<NightShiftSettings>(STORAGE_KEYS.NIGHT_SETTINGS),
      fetchAppState<FiscalParameters>(STORAGE_KEYS.FISCAL_PARAMETERS),
      fetchAppState<EmailConfig>(STORAGE_KEYS.EMAIL_CONFIG),
      fetchAppState<EmailTemplate>(STORAGE_KEYS.EMAIL_TEMPLATE),
    ])
    const patch: Partial<AppSettings> = {}
    if (payroll) { const m = { ...get().payroll, ...payroll }; storage.set(STORAGE_KEYS.PAYROLL_SETTINGS, m); patch.payroll = m }
    if (nightShift) { const m = { ...get().nightShift, ...nightShift }; storage.set(STORAGE_KEYS.NIGHT_SETTINGS, m); patch.nightShift = m }
    if (fiscal) { const m = { ...get().fiscal, ...fiscal }; storage.set(STORAGE_KEYS.FISCAL_PARAMETERS, m); patch.fiscal = m }
    if (email) { const m = { ...get().email, ...email }; storage.set(STORAGE_KEYS.EMAIL_CONFIG, m); patch.email = m }
    if (emailTemplate) { const m = { ...get().emailTemplate, ...emailTemplate }; storage.set(STORAGE_KEYS.EMAIL_TEMPLATE, m); patch.emailTemplate = m }
    if (Object.keys(patch).length > 0) set(patch)
  },
}))
