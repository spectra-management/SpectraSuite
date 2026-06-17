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
  PAYROLL_HISTORY: 'payroll_history',
  LANGUAGE: 'language',
} as const
