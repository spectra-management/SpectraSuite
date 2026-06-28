import { create } from 'zustand'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { saveAppState, fetchAppState } from '@/shared/lib/cloudSync'
import { fetchUsdToDop, todayLocal, type ExchangeRate } from '@/shared/lib/exchangeRate'

/**
 * Daily USD -> DOP exchange-rate cache.
 *
 * The rate is fetched live (open.er-api.com, exchangerate.host fallback) at most once per
 * calendar day and cached in localStorage + the shared `app_state` row so every user sees
 * the same daily rate. `ensureFresh()` is safe to call often: it only hits the network when
 * the cached rate is from a previous day (or missing).
 */
interface ExchangeRateState {
  cache: ExchangeRate | null
  /** True while a live fetch is in flight. */
  loading: boolean
  /** DOP per 1 USD, or null if never fetched. */
  rate: () => number | null
  /** Convert a peso (DOP) amount to USD, or null when no rate is known. */
  toUsd: (dop: number) => number | null
  /** Pull the shared cached rate from the DB (call on login). */
  hydrate: () => Promise<void>
  /** Fetch today's rate if the cache is stale/missing; persists locally + to the cloud. */
  ensureFresh: () => Promise<void>
}

export const useExchangeRateStore = create<ExchangeRateState>((set, get) => ({
  cache: storage.get<ExchangeRate>(STORAGE_KEYS.EXCHANGE_RATE),
  loading: false,

  rate: () => get().cache?.rate ?? null,
  toUsd: (dop) => {
    const r = get().cache?.rate
    return r && r > 0 ? dop / r : null
  },

  hydrate: async () => {
    const cloud = await fetchAppState<ExchangeRate>(STORAGE_KEYS.EXCHANGE_RATE)
    if (cloud && cloud.rate > 0) {
      set({ cache: cloud })
      storage.set(STORAGE_KEYS.EXCHANGE_RATE, cloud)
    }
    void get().ensureFresh()
  },

  ensureFresh: async () => {
    const cache = get().cache
    if (cache && cache.date === todayLocal()) return // already today's rate
    if (get().loading) return
    set({ loading: true })
    try {
      const fresh = await fetchUsdToDop()
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
