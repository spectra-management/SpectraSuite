import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Users, Wallet, Building2, FileClock, type LucideIcon } from 'lucide-react'
import { Card } from '@/shared/components/ui/card'
import { cn } from '@/shared/lib/utils'
import { formatCurrency } from '@/shared/lib/utils'
import { UsdAmount } from '@/shared/components/UsdAmount'
import { useAuth } from '@/shared/context/AuthContext'
import { useEmployeesStore } from '@/shared/store/employeesStore'
import { usePayrollStore } from '@/shared/store/payrollStore'
import { useEmployeeHrStore } from '@/shared/store/employeeHrStore'
import { useBillingStore } from '@/modules/facturacion/store/billingStore'

interface Kpi {
  key: string
  label: string
  value: string
  icon: LucideIcon
  to?: string
  module?: 'nomina' | 'rrhh' | 'facturacion'
  /** Peso amount to also show as a USD equivalent under the value. */
  subDop?: number
}

/**
 * Top-of-dashboard KPI strip for managers: a fast, at-a-glance read of the business.
 * Each card only shows if the manager can access the relevant module; clicking deep-links in.
 */
export function KpiStrip() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { hasModuleAccess } = useAuth()
  const employees = useEmployeesStore((s) => s.employees)
  const history = usePayrollStore((s) => s.history)
  const hrById = useEmployeeHrStore((s) => s.byId)
  const clients = useBillingStore((s) => s.clients)
  const invoices = useBillingStore((s) => s.invoices)

  const activeCount = useMemo(() => employees.filter((e) => e.status === 'Active').length, [employees])
  const lastRun = useMemo(() => {
    if (history.length === 0) return null
    return [...history].sort((a, b) =>
      (b.processedDate ?? b.endDate).localeCompare(a.processedDate ?? a.endDate))[0]
  }, [history])
  // Clients = distinct BambooHR divisions (the same basis billing uses), so the count is
  // meaningful even before the billing module has been opened; fall back to billing clients.
  const clientCount = useMemo(() => {
    const divisions = new Set(
      Object.values(hrById).map((e) => (e.division ?? '').trim()).filter(Boolean),
    )
    return divisions.size || clients.length
  }, [hrById, clients])
  const draftCount = useMemo(() => invoices.filter((i) => i.status === 'draft').length, [invoices])

  const kpis: Kpi[] = [
    { key: 'employees', label: t('suiteHome.kpi.activeEmployees'), value: String(activeCount), icon: Users, to: '/rrhh/directory', module: 'rrhh' },
    { key: 'payroll', label: t('suiteHome.kpi.lastPayroll'), value: lastRun ? formatCurrency(lastRun.totals.totalNet) : '—', icon: Wallet, to: '/nomina/history', module: 'nomina', subDop: lastRun ? lastRun.totals.totalNet : undefined },
    { key: 'clients', label: t('suiteHome.kpi.clients'), value: String(clientCount), icon: Building2, to: '/facturacion/clients', module: 'facturacion' },
    { key: 'drafts', label: t('suiteHome.kpi.draftInvoices'), value: String(draftCount), icon: FileClock, to: '/facturacion/invoices', module: 'facturacion' },
  ]

  const visible = kpis.filter((k) => !k.module || hasModuleAccess(k.module))
  if (visible.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {visible.map((k) => {
        const Icon = k.icon
        const clickable = !!k.to
        return (
          <Card
            key={k.key}
            onClick={clickable ? () => navigate(k.to!) : undefined}
            className={cn(
              'flex items-center gap-3 p-4',
              clickable && 'cursor-pointer transition-all hover:border-emerald-300 hover:shadow-md',
            )}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-figure truncate text-xl font-bold leading-tight text-foreground">{k.value}</p>
              {k.subDop !== undefined && <UsdAmount dop={k.subDop} className="block truncate" />}
              <p className="truncate text-xs text-muted-foreground">{k.label}</p>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
