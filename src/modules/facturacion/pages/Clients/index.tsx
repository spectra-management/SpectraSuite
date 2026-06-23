import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Plus, Search, Building2, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { normalize } from '@/shared/lib/utils'
import { currencySymbol } from '@/shared/lib/utils/currency'
import { useBillingStore } from '@/modules/facturacion/store/billingStore'
import { useBillingAccess } from '@/modules/facturacion/lib/permissions'
import { auditClientCreated } from '@/modules/facturacion/lib/audit'
import { BillingPageHeader } from '@/modules/facturacion/components/BillingPageHeader'
import { EmptyStateCard } from '@/modules/facturacion/components/BillingStates'
import { ClientFormDialog, type ClientFormValues } from '@/modules/facturacion/components/ClientFormDialog'

export default function Clients() {
  const { t } = useTranslation()
  const { canEdit } = useBillingAccess()
  const clients = useBillingStore((s) => s.clients)
  const assignments = useBillingStore((s) => s.clientEmployees)
  const invoices = useBillingStore((s) => s.invoices)
  const addClient = useBillingStore((s) => s.addClient)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  const filtered = useMemo(() => {
    const q = normalize(search)
    return clients
      .filter((c) => !q || normalize(c.name).includes(q) || normalize(c.contactName).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [clients, search])

  const countFor = (clientId: string, list: { clientId: string; active?: boolean }[]) =>
    list.filter((x) => x.clientId === clientId && x.active !== false).length

  const handleCreate = (values: ClientFormValues) => {
    const c = addClient(values)
    auditClientCreated(c.id, c.name)
  }

  return (
    <div className="space-y-6">
      <BillingPageHeader
        title={t('facturacion.clients.title')}
        subtitle={t('facturacion.clients.subtitle')}
        actions={
          canEdit ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('facturacion.clients.newClient')}
            </Button>
          ) : undefined
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder={t('common.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyStateCard
          title={t('facturacion.clients.emptyTitle')}
          hint={canEdit ? t('facturacion.clients.emptyHint') : undefined}
          action={canEdit ? <Button className="mt-2" onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />{t('facturacion.clients.newClient')}</Button> : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} to={`/facturacion/clients/${c.id}`}>
              <Card className="h-full transition-colors hover:border-emerald-300 dark:hover:border-emerald-700">
                <CardContent className="flex h-full flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <Building2 className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.contactName || c.contactEmail || '—'}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary">{c.invoicePrefix}</Badge>
                    <Badge variant="outline">{t(`facturacion.method.${c.defaultMethod}`)}</Badge>
                    <Badge variant="outline">{currencySymbol(c.currencyCountry)}</Badge>
                    {!c.active && <Badge variant="warning">{t('facturacion.clients.inactive')}</Badge>}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{countFor(c.id, assignments)} {t('facturacion.clients.assignedShort')}</span>
                    <span>{countFor(c.id, invoices)} {t('facturacion.nav.invoices').toLowerCase()}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ClientFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleCreate} />
    </div>
  )
}
