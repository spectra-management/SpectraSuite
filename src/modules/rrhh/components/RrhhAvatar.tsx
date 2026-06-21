import { useState } from 'react'
import { cn, getInitials } from '@/shared/lib/utils'
import type { RrhhEmployee } from '@/modules/rrhh/types'

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
} as const

/**
 * Employee avatar: BambooHR photo when present and loadable, otherwise initials on the
 * emerald chip used across Spectra Suite. Falls back gracefully if the image 404s.
 */
export function RrhhAvatar({
  employee,
  size = 'md',
  className,
}: {
  employee: Pick<RrhhEmployee, 'firstName' | 'lastName' | 'photoUrl'>
  size?: keyof typeof SIZES
  className?: string
}) {
  const [errored, setErrored] = useState(false)
  const showPhoto = !!employee.photoUrl && !errored

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-emerald-100 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
        SIZES[size],
        size === 'lg' && 'rounded-2xl',
        className,
      )}
    >
      {showPhoto ? (
        <img
          src={employee.photoUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        getInitials(employee.firstName, employee.lastName)
      )}
    </div>
  )
}
