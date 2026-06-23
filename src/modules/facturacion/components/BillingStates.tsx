import type { ReactNode } from 'react'
import { Inbox, ShieldAlert } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'

/** Generic empty-state card for the billing module. */
export function EmptyStateCard({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
          <Inbox className="h-7 w-7" />
        </span>
        <p className="text-base font-semibold text-foreground">{title}</p>
        {hint && <p className="max-w-md text-sm text-muted-foreground">{hint}</p>}
        {action}
      </CardContent>
    </Card>
  )
}

/** Inline gate shown when the viewer lacks the financial (admin) permission. */
export function RestrictedCard({ title, hint }: { title: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <p className="text-base font-semibold text-foreground">{title}</p>
        {hint && <p className="max-w-md text-sm text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
