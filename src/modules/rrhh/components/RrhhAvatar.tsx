import { useState } from 'react'
import { cn, getInitials } from '@/shared/lib/utils'
import type { RrhhEmployee } from '@/modules/rrhh/types'

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
} as const

/**
 * Employee avatar: a BambooHR photo when present and loadable, otherwise initials on the
 * emerald chip used across Spectra Suite. Falls back gracefully if the image fails.
 *
 * Photo source priority: explicit `src` (e.g. the proxied photo endpoint) → the
 * employee's report `photoUrl` → initials. The photo never blocks the rest of the
 * profile: it loads independently and silently degrades to initials on error.
 */
export function RrhhAvatar({
  employee,
  src,
  size = 'md',
  className,
}: {
  employee: Pick<RrhhEmployee, 'firstName' | 'lastName' | 'photoUrl'>
  /** Preferred photo URL (e.g. the proxied BambooHR photo endpoint). */
  src?: string
  size?: keyof typeof SIZES
  className?: string
}) {
  // Candidate URLs, in order; advance to the next on load error, then initials.
  const candidates = [src, employee.photoUrl].filter((u): u is string => !!u)
  const [idx, setIdx] = useState(0)
  const current = candidates[idx]

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
        SIZES[size],
        size === 'lg' && 'rounded-2xl',
        className,
      )}
    >
      {current ? (
        <img
          key={current}
          src={current}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setIdx((i) => i + 1)}
        />
      ) : (
        getInitials(employee.firstName, employee.lastName)
      )}
    </div>
  )
}
