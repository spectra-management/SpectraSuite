import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { roundHalfUp } from './number'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  const rounded = roundHalfUp(value, 2)
  return `RD$ ${rounded.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateRange(start: string, end: string): string {
  return `${formatDate(start)} – ${formatDate(end)}`
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** "****1234" — masked last-4 of an account number, or '' if empty. */
export function maskAccount(accountNumber?: string): string {
  const digits = (accountNumber ?? '').replace(/\s/g, '')
  if (!digits) return ''
  return digits.length <= 4 ? `****${digits}` : `****${digits.slice(-4)}`
}

/**
 * Format a pay rate with its currency from BambooHR.
 * currency = ''  → "Not set" (not configured in BambooHR)
 * currency = undefined → legacy data, fallback to RD$
 * currency = 'DOP' → RD$ X.XX
 * currency = 'USD' → $ X.XX
 * other currencies → CURR X.XX
 */
export function formatPayRate(rate: number, currency: string | undefined): string {
  if (currency === '') return 'Not set'
  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (!currency || currency === 'DOP') return `RD$ ${fmt(rate)}`
  if (currency === 'USD') return `$ ${fmt(rate)}`
  return `${currency} ${fmt(rate)}`
}

/**
 * Remove accents/diacritics and lowercase — for accent-insensitive search.
 */
export function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}
