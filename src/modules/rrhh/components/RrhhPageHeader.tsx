import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { formatDate } from '@/shared/lib/utils'

/**
 * Standard RRHH page header: title + subtitle on the left, an optional Sync button and
 * extra actions on the right. Matches the Nómina Employees page header exactly.
 */
export function RrhhPageHeader({
  title,
  subtitle,
  syncing,
  onSync,
  lastSync,
  actions,
}: {
  title: string
  subtitle: string
  syncing?: boolean
  onSync?: () => void
  lastSync?: string | null
  actions?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        {onSync && (
          <p className="mt-1 text-xs text-muted-foreground">
            {t('rrhh.common.lastSync')}:{' '}
            {lastSync ? formatDate(lastSync.slice(0, 10)) : t('rrhh.common.neverSynced')}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onSync && (
          <Button onClick={onSync} disabled={syncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? t('rrhh.common.syncing') : t('rrhh.common.sync')}
          </Button>
        )}
      </div>
    </div>
  )
}
