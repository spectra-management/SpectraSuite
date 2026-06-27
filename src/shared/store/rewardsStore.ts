import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/shared/lib/supabase'
import { storage, STORAGE_KEYS } from '@/shared/lib/storage'
import { saveAppState, fetchAppState } from '@/shared/lib/cloudSync'

/** Points granted per daily check-in. */
export const DAILY_POINTS = 10
/** Streak milestones that unlock a badge (consecutive-day thresholds). */
export const REWARD_MILESTONES = [3, 7, 30, 100] as const

export interface UserRewards {
  points: number
  streak: number
  bestStreak: number
  totalDays: number
  lastCheckIn: string | null // YYYY-MM-DD
}

interface RewardsRow {
  user_id: string
  points: number | null
  streak: number | null
  best_streak: number | null
  total_days: number | null
  last_check_in: string | null
}

const ZERO: UserRewards = { points: 0, streak: 0, bestStreak: 0, totalDays: 0, lastCheckIn: null }

/** Local date as YYYY-MM-DD (rewards are "per calendar day" in the user's timezone). */
function localDay(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function dayBefore(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() - 1)
  return localDay(d)
}

async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

interface RewardsState {
  /** Super-admin on/off switch (shared via app_state). */
  enabled: boolean
  setEnabled: (enabled: boolean) => void
  hydrateEnabled: () => Promise<void>

  /** Signed-in user's rewards. */
  rewards: UserRewards
  /** Points earned on the most recent check-in this session (drives a toast); null = none. */
  todayEarned: number | null
  loaded: boolean

  /** Idempotent daily check-in: grants points/streak once per calendar day. */
  checkIn: () => Promise<void>
  clearTodayEarned: () => void
}

export const useRewardsStore = create<RewardsState>((set) => ({
  enabled: storage.get<boolean>(STORAGE_KEYS.REWARDS_ENABLED) ?? false,

  setEnabled: (enabled) => {
    set({ enabled })
    storage.set(STORAGE_KEYS.REWARDS_ENABLED, enabled)
    void saveAppState(STORAGE_KEYS.REWARDS_ENABLED, enabled) // shared across users
  },

  hydrateEnabled: async () => {
    const cloud = await fetchAppState<boolean>(STORAGE_KEYS.REWARDS_ENABLED)
    if (cloud !== null) {
      set({ enabled: cloud })
      storage.set(STORAGE_KEYS.REWARDS_ENABLED, cloud)
    }
  },

  rewards: ZERO,
  todayEarned: null,
  loaded: false,

  checkIn: async () => {
    const uid = await currentUserId()
    if (!uid) return
    try {
      const { data } = await supabase
        .from('portal_rewards')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle()
      const row = data as RewardsRow | null
      const today = localDay(new Date())

      const prev: UserRewards = row
        ? {
            points: row.points ?? 0,
            streak: row.streak ?? 0,
            bestStreak: row.best_streak ?? 0,
            totalDays: row.total_days ?? 0,
            lastCheckIn: row.last_check_in ?? null,
          }
        : ZERO

      // Already checked in today: nothing to grant.
      if (prev.lastCheckIn === today) {
        set({ rewards: prev, todayEarned: null, loaded: true })
        return
      }

      const continues = prev.lastCheckIn !== null && prev.lastCheckIn === dayBefore(today)
      const streak = continues ? prev.streak + 1 : 1
      const next: UserRewards = {
        points: prev.points + DAILY_POINTS,
        streak,
        bestStreak: Math.max(prev.bestStreak, streak),
        totalDays: prev.totalDays + 1,
        lastCheckIn: today,
      }

      set({ rewards: next, todayEarned: DAILY_POINTS, loaded: true })

      await supabase.from('portal_rewards').upsert(
        {
          user_id: uid,
          points: next.points,
          streak: next.streak,
          best_streak: next.bestStreak,
          total_days: next.totalDays,
          last_check_in: next.lastCheckIn,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
    } catch (e) {
      console.warn('[rewards] checkIn failed:', e)
      set({ loaded: true })
    }
  },

  clearTodayEarned: () => set({ todayEarned: null }),
}))
