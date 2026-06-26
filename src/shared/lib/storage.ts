/**
 * Storage abstraction layer.
 * Wraps localStorage today; designed for Supabase/Postgres migration.
 * All keys are prefixed with 'spectra_' to avoid collisions.
 */

const PREFIX = 'spectra_'

export const storage = {
  get<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(`${PREFIX}${key}`)
      if (raw === null) return null
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(`${PREFIX}${key}`, JSON.stringify(value))
    } catch {
      console.error(`[storage] Failed to set key: ${key}`)
    }
  },

  remove(key: string): void {
    localStorage.removeItem(`${PREFIX}${key}`)
  },

  clear(): void {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  },
}

export const STORAGE_KEYS = {
  COMPANY: 'company_settings',
  PAYROLL_SETTINGS: 'payroll_settings',
  NIGHT_SETTINGS: 'payroll_night_settings',
  FISCAL_PARAMETERS: 'fiscal_parameters',
  BAMBOOHR_CONFIG: 'bamboohr_config',
  HUBSTAFF_CONFIG: 'hubstaff_config',
  EMAIL_CONFIG: 'email_config',
  EMAIL_TEMPLATE: 'email_template',
  EMPLOYEES: 'employees',
  PAYMENT_METHODS: 'employee_payment_methods',
  BANK_ACCOUNTS: 'employee_bank_accounts',
  HOLIDAYS: 'payroll_holidays',
  HOLIDAYS_LAST_SYNC: 'holidays_last_sync',
  VACATION_RULES: 'vacation_rules',
  VACATION_PAYMENTS: 'vacation_payments_made',
  PENDING_VACATION_ISR: 'pending_vacation_isr',
  PAYROLL_HISTORY: 'payroll_history',
  LANGUAGE: 'language',
  // Billing (facturación) module
  BILLING_CLIENTS: 'billing_clients',
  BILLING_TITLE_RATES: 'billing_title_rates',
  BILLING_CLIENT_EMPLOYEES: 'billing_client_employees',
  BILLING_INVOICES: 'billing_invoices',
  BILLING_META: 'billing_meta',
  // Documentos (company documents) module
  DOCUMENT_TEMPLATES: 'document_templates',
  GENERATED_DOCUMENTS: 'generated_documents',
  // Cloud-backed employee HR detail (cédula, address, phone, DOB…) for Documentos/RRHH
  EMPLOYEES_HR: 'employees_hr',
  // Cloud-backed per-employee payroll overrides (tax exemption) shared by Nómina + RRHH
  EMPLOYEE_PAYROLL_SETTINGS: 'employee_payroll_settings',
  // Cloud-backed per-employee baseball-card overrides (auto-filled from HR, editable)
  EMPLOYEE_BASEBALL_CARDS: 'employee_baseball_cards',
  // Per-country fiscal configs (employee deductions + income tax), editable in Nómina settings
  COUNTRY_FISCAL: 'country_fiscal_configs',
} as const
