import { useTranslation } from 'react-i18next'
import { DollarSign, Users, TrendingDown, TrendingUp, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePayrollStore } from '@/store/payrollStore'
import { useEmployeesStore } from '@/store/employeesStore'
import { formatCurrency, formatDate } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  colorClass: string
  bgClass: string
}

function StatCard({ title, value, sub, icon: Icon, colorClass, bgClass }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
            {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bgClass}`}>
            <Icon className={`h-6 w-6 ${colorClass}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number; name: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-lg">
      <p className="text-xs font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs text-gray-600">
          {p.name}: <span className="font-semibold text-emerald-700">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { t } = useTranslation()
  const history = usePayrollStore((s) => s.history)
  const employees = useEmployeesStore((s) => s.employees)

  const lastPayroll = history[history.length - 1]
  const activeCount = employees.filter((e) => e.status === 'Active').length

  const chartData = history.slice(-8).map((p) => ({
    period: `${p.startDate.slice(5)}`,
    [t('dashboard.gross')]: p.totals.totalGross,
    [t('dashboard.net')]: p.totals.totalNet,
    [t('dashboard.deductions')]: p.totals.totalDeductions,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('dashboard.subtitle')}</p>
      </div>

      {lastPayroll ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title={t('dashboard.totalGross')}
              value={formatCurrency(lastPayroll.totals.totalGross)}
              sub={t('dashboard.lastPeriod')}
              icon={DollarSign}
              colorClass="text-emerald-600"
              bgClass="bg-emerald-50"
            />
            <StatCard
              title={t('dashboard.totalDeductions')}
              value={formatCurrency(lastPayroll.totals.totalDeductions)}
              sub={t('dashboard.lastPeriod')}
              icon={TrendingDown}
              colorClass="text-red-500"
              bgClass="bg-red-50"
            />
            <StatCard
              title={t('dashboard.totalNet')}
              value={formatCurrency(lastPayroll.totals.totalNet)}
              sub={t('dashboard.lastPeriod')}
              icon={TrendingUp}
              colorClass="text-blue-500"
              bgClass="bg-blue-50"
            />
            <StatCard
              title={t('dashboard.employeeCount')}
              value={String(activeCount)}
              sub={`${lastPayroll.totals.employeeCount} in last payroll`}
              icon={Users}
              colorClass="text-purple-500"
              bgClass="bg-purple-50"
            />
          </div>

          {chartData.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.payrollCost')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v: number) => `RD$ ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={70} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey={t('dashboard.gross')} stroke="#059669" strokeWidth={2} fill="url(#grossGrad)" />
                    <Area type="monotone" dataKey={t('dashboard.net')} stroke="#3B82F6" strokeWidth={2} fill="url(#netGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('dashboard.recentPayrolls')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[...history].reverse().slice(0, 5).map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {formatDate(p.startDate)} – {formatDate(p.endDate)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {p.totals.employeeCount} {t('common.employees')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-emerald-700">
                          {formatCurrency(p.totals.totalNet)}
                        </p>
                        <Badge variant="secondary" className="text-xs">
                          {t(`history.status.${p.status}`)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('dashboard.quickActions')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button asChild className="w-full justify-start">
                  <Link to="/payroll">
                    <DollarSign className="mr-2 h-4 w-4" />
                    {t('dashboard.processPayroll')}
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link to="/employees">
                    <Users className="mr-2 h-4 w-4" />
                    {t('dashboard.syncEmployees')}
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full justify-start">
                  <Link to="/history">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    {t('nav.history')}
                    <ArrowRight className="ml-auto h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
              <DollarSign className="h-8 w-8 text-emerald-600" />
            </div>
            <p className="mt-4 text-sm text-gray-500">{t('dashboard.noPayrollData')}</p>
            <Button asChild className="mt-4">
              <Link to="/payroll">
                {t('dashboard.processPayroll')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {employees.length === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-amber-700">
              No employees found.{' '}
              <Link to="/connectors" className="font-medium underline">
                Configure BambooHR
              </Link>{' '}
              and sync employees to get started.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
