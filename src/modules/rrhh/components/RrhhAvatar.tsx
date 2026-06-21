import { useEffect, useState } from 'react'
import { cn, getInitials } from '@/shared/lib/utils'
import type { RrhhEmployee } from '@/modules/rrhh/types'

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-2xl sm:h-28 sm:w-28 sm:text-3xl',
} as const

/**
 * Employee avatar: a custom/BambooHR photo when present and loadable, otherwise initials
 * on the emerald chip used across Spectra Suite. Falls back gracefully if the image fails.
 *
 * Photo source priority: `customSrc` (an admin-set Supabase override) → `src` (the
 * proxied BambooHR photo endpoint) → the employee's report `photoUrl` → initials. The
 * photo never blocks render: images load lazily and silently degrade to the next
 * candidate, then to initials, on error.
 */
export function RrhhAvatar({
  employee,
  customSrc,
  src,
  size = 'md',
  className,
}: {
  employee: Pick<RrhhEmployee, 'firstName' | 'lastName' | 'photoUrl'>
  /** Highest-priority photo URL: an admin-set custom (Supabase) photo. */
  customSrc?: string
  /** Preferred BambooHR photo URL (e.g. the proxied photo endpoint). */
  src?: string
  size?: keyof typeof SIZES
  className?: string
}) {
  // Candidate URLs, in priority order; advance to the next on load error, then initials.
  const candidates = [customSrc, src, employee.photoUrl].filter((u): u is string => !!u)
  const [idx, setIdx] = useState(0)
  // If the candidate list changes (e.g. a new custom photo is set), restart from the top.
  const key = candidates.join('|')
  useEffect(() => {
    setIdx(0)
  }, [key])
  const current = candidates[idx]

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
        SIZES[size],
        (size === 'lg' || size === 'xl') && 'rounded-2xl',
        className,
      )}
    >
      {current ? (
        <img
          key={`${key}#${idx}`}
          src={current}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        getInitials(employee.firstName, employee.lastName)
      )}
    </div>
  )
}
