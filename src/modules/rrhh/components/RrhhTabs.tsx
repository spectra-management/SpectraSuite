import type { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export interface RrhhTab {
  id: string
  label: string
  icon: LucideIcon
}

/**
 * Horizontal, scrollable tab bar used on the employee profile. Purely presentational;
 * the active tab is owned by the parent. Matches the Suite's emerald/underline style and
 * works in light & dark mode.
 */
export function RrhhTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: RrhhTab[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div className="border-b border-border">
      <div className="-mb-px flex gap-1 overflow-x-auto" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-emerald-600 text-emerald-700 dark:text-emerald-300'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
