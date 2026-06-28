import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { saveAppState, fetchAppState } from '@/shared/lib/cloudSync'
import { fetchRates, todayLocal, type RatesSnapshot } from '@/shared/lib/exchangeRate'

/**
 * Daily foreign-exchange cache (all payroll currencies vs USD).
 *
 * Rates are fetched live (open.er-api.com, exchangerate.host fallback) at most once per
 * calendar day and cached in localStorage + the shared `app_state` row so every user sees
 * the same daily rates. `ensureFresh()` is safe to call often: it only hits the network when
 * the cached snapshot is from a previous day (or missing).
 */
interface ExchangeRateState {
  cache: RatesSnapshot | null
  /** True while a live fetch is in flight. */
  loading: boolean
  /** Units of `code` per 1 USD (e.g. 'DOP' -> ~59), or null if unknown. */
  rateFor: (code: string) => number | null
  /** Convert an amount in `code` to USD, or null when the rate is unknown. */
  toUsd: (amount: number, code: string) => number | null
  /** Pull the shared cached snapshot from the DB (call on login). */
  hydrate: () => Promise<void>
  /** Fetch today's rates if the cache is stale/missing; persists locally + to the cloud. */
  ensureFresh: () => Promise<void>
}

export const useExchangeRateStore = create<ExchangeRateState>((set, get) => ({
  cache: storage.get<RatesSnapshot>(STORAGE_KEYS.EXCHANGE_RATE),
  loading: false,

  rateFor: (code) => {
    const r = get().cache?.rates?.[code]
    return typeof r === 'number' && r > 0 ? r : null
  },
  toUsd: (amount, code) => {
    if (code === 'USD') return amount
    const r = get().cache?.rates?.[code]
    return typeof r === 'number' && r > 0 ? amount / r : null
  },

  hydrate: async () => {
    const cloud = await fetchAppState<RatesSnapshot>(STORAGE_KEYS.EXCHANGE_RATE)
    if (cloud && cloud.rates && Object.keys(cloud.rates).length > 0) {
      set({ cache: cloud })
      storage.set(STORAGE_KEYS.EXCHANGE_RATE, cloud)
    }
    void get().ensureFresh()
  },

  ensureFresh: async () => {
    const cache = get().cache
    if (cache && cache.date === todayLocal()) return // already today's rates
    if (get().loading) return
    set({ loading: true })
    try {
      const fresh = await fetchRates()
      if (fresh) {
        set({ cache: fresh })
        storage.set(STORAGE_KEYS.EXCHANGE_RATE, fresh)
        void saveAppState(STORAGE_KEYS.EXCHANGE_RATE, fresh) // best-effort shared cache
      }
    } finally {
      set({ loading: false })
    }
  },
}))
