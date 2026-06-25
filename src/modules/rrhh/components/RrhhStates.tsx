import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PlugZap, AlertTriangle, Inbox, RefreshCw } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'

/** Shown when BambooHR has not been connected (in Nómina → Connectors). */
export function NotConnectedCard() {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
          <PlugZap className="h-7 w-7" />
        </span>
        <p className="text-base font-semibold text-foreground">{t('rrhh.common.notConnected')}</p>
        <p className="max-w-md text-sm text-muted-foreground">{t('rrhh.common.notConnectedDesc')}</p>
        <Button variant="outline" asChild className="mt-1">
          <Link to="/suite/connectors">{t('rrhh.common.goToConnectors')}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

/** Shown when a BambooHR fetch fails. */
export function LoadErrorCard({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="h-7 w-7" />
        </span>
        <p className="text-base font-semibold text-foreground">{t('rrhh.common.loadError')}</p>
        {message && <p className="max-w-md text-sm text-muted-foreground">{message}</p>}
        {onRetry && (
          <Button variant="outline" className="mt-1" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('rrhh.common.retry')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

/** Generic empty-state card. */
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
