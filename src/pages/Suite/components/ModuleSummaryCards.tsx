import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Users, CalendarDays, Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useEmployeesStore } from '@/store/employeesStore'
import { usePayrollStore } from '@/store/payrollStore'
import { formatCurrency } from '@/lib/utils'
import { MODULE_ICONS } from '@/components/moduleIcons'

// Module summary cards shown in the dashboard's left column — only for modules
// the signed-in user can access.

export function ModuleSummaryCards() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { hasModuleAccess } = useAuth()
  const employees = useEmployeesStore((s) => s.employees)
  const history = usePayrollStore((s) => s.history)

  const NominaIcon = MODULE_ICONS.nomina
  const activeCount = useMemo(() => employees.filter((e) => e.status === 'Active').length, [employees])

  const lastRun = useMemo(() => {
    if (history.length === 0) return null
    return [...history].sort((a, b) =>
      (b.processedDate ?? b.endDate).localeCompare(a.processedDate ?? a.endDate))[0]
  }, [history])

  return (
    <div className="space-y-4">
      {/* Nómina — the live module, marked with an emerald ledger rule */}
      {hasModuleAccess('nomina') && (
        <Card className="overflow-hidden border-t-2 border-t-emerald-600">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <NominaIcon className="h-4 w-4" strokeWidth={1.75} />
              </span>
              {t('suite.modules.nomina')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat icon={<Users className="h-4 w-4" />} label={t('suiteHome.nomina.employees')} value={String(activeCount)} />
              <Stat
                icon={<Wallet className="h-4 w-4" />}
                label={t('suiteHome.nomina.lastTotal')}
                value={lastRun ? formatCurrency(lastRun.totals.totalNet) : '—'}
              />
            </div>
            <Button size="sm" className="w-full gap-1.5" onClick={() => navigate('/nomina/payroll')}>
              {t('suiteHome.nomina.process')} <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* RRHH — placeholder data */}
      {hasModuleAccess('rrhh') && (
        <ComingSoonCard
          moduleId="rrhh"
          title={t('suite.modules.rrhh')}
          stats={[
            { icon: <Users className="h-4 w-4" />, label: t('suiteHome.rrhh.totalEmployees'), value: String(employees.length) },
            { icon: <CalendarDays className="h-4 w-4" />, label: t('suiteHome.rrhh.onVacation'), value: '—' },
          ]}
        />
      )}

      {/* Facturación */}
      {hasModuleAccess('facturacion') && (
        <ComingSoonCard moduleId="facturacion" title={t('suite.modules.facturacion')} stats={[]} />
      )}

      {/* Gastos */}
      {hasModuleAccess('gastos') && (
        <ComingSoonCard moduleId="gastos" title={t('suite.modules.gastos')} stats={[]} />
      )}

      {/* IT */}
      {hasModuleAccess('it') && (
        <ComingSoonCard moduleId="it" title={t('suite.modules.it')} stats={[]} />
      )}
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary p-3">
      <div className="flex items-center gap-1.5 text-gray-400">{icon}<span className="text-xs">{label}</span></div>
      <p className="text-figure mt-1 truncate text-lg font-bold text-gray-900">{value}</p>
    </div>
  )
}

function ComingSoonCard({
  moduleId, title, stats,
}: {
  moduleId: 'rrhh' | 'facturacion' | 'gastos' | 'it'
  title: string
  stats: { icon: React.ReactNode; label: string; value: string }[]
}) {
  const { t } = useTranslation()
  const Icon = MODULE_ICONS[moduleId]
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-gray-500">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </span>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {stats.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s, i) => <Stat key={i} {...s} />)}
          </div>
        ) : (
          <div className="py-4" />
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            {t('suite.comingSoon')}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
