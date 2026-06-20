/**
 * Shared layer — public API.
 *
 * Cross-cutting code every module may depend on: contexts, hooks, stores, and
 * types. NOTE: `lib` and `components` are intentionally NOT re-exported here —
 * they expose overlapping names (e.g. two `formatCurrency` helpers in
 * `lib/utils.ts` vs `lib/utils/currency.ts`). Import those from their explicit
 * paths, e.g. `@/shared/lib/utils/currency` or `@/shared/components/ui/button`.
 */
export * from './context'
export * from './hooks'
export * from './store'
export * from './types'
