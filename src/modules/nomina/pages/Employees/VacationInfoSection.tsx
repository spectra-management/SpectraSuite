import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Palmtree, Loader2, FileText, CheckCircle2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useVacationPaymentsStore } from '@/shared/store/vacationPaymentsStore'
import { usePendingVacationIsrStore } from '@/shared/store/pendingVacationIsrStore'
import { formatCurrencyWithSymbol } from '@/modules/nomina/lib/payroll/calculations'
import { getCurrencySymbol } from '@/modules/nomina/lib/payroll/rules'
import { formatDate } from '@/shared/lib/utils'
import {
  getVacationRules, isVacationConfigured, getVacationDays, yearsOfService, calculateVacationPay,
} from '@/modules/nomina/lib/vacations'
import {
  fetchVacations, getVacationsForEmployee, countVacationDays, type VacationRequest,
} from '@/shared/connectors/bamboohr-vacations'
import { VacationReceiptModal } from './VacationReceiptModal'
import type { Employee } from '@/shared/types'

export function VacationInfoSection({ employee }: { employee: Employee }) {
  const { t } = useTranslation()
  const bamboo = useSettingsStore((s) => s.bamboohr)
  const getPayment = useVacationPaymentsStore((s) => s.getPayment)
  const markPaid = useVacationPaymentsStore((s) => s.markPaid)
  const paymentsMap = useVacationPaymentsStore((s) => s.payments) // subscribe for re-render
  const setPendingIsr = usePendingVacationIsrStore((s) => s.setPending)
  const pendingIsrMap = usePendingVacationIsrStore((s) => s.pending) // subscribe for re-render

  const year = new Date().getFullYear()
  const country = employee.country || ''
  const configured = isVacationConfigured(country)
  const rules = getVacationRules(country)
  const years = yearsOfService(employee.hireDate)
  const entitledDays = rules ? getVacationDays(rules.tiers, years) : 0
  const pay = calculateVacationPay(country, employee.payRate, years, employee.payType) // entitlement-based
  const fmt = (n: number) => formatCurrencyWithSymbol(n, getCurrencySymbol(country))

  const [vacations, setVacations] = useState<VacationRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)

  const connected = bamboo.connected && !!bamboo.subdomain && !!bamboo.apiKey
  void paymentsMap
  const payment = getPayment(employee.id, year)
  const isr = pendingIsrMap[employee.id] ?? null

  // Earliest vacation request of the year triggers the (single) payment.
  const sorted = [...vacations].sort((a, b) => a.start.localeCompare(b.start))
  const firstReq = sorted[0]
  const firstReqDaysTaken = firstReq ? countVacationDays(firstReq.dates) : 0
  const firstReqLabel = firstReq ? `${formatDate(firstReq.start)} → ${formatDate(firstReq.end)}` : undefined

  useEffect(() => {
    if (!configured || !connected) return
    let cancelled = false
    setLoading(true)
    setError(false)
    fetchVacations(bamboo.subdomain, bamboo.apiKey, year)
      .then((all) => { if (!cancelled) setVacations(getVacationsForEmployee(employee.id, all)) })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [employee.id, configured, connected, bamboo.subdomain, bamboo.apiKey, year])

  if (!configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palmtree className="h-4 w-4 text-emerald-600" /> {t('employees.vacation.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('employees.vacation.notConfigured', { country: country || '—' })}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Palmtree className="h-4 w-4 text-emerald-600" /> {t('employees.vacation.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">{t('employees.vacation.yearsOfService')}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground">{years}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('employees.vacation.entitledDays')}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground">{entitledDays}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t('employees.vacation.estimatedPay')}</dt>
            <dd className="mt-0.5 text-sm font-semibold text-emerald-700">{pay ? fmt(pay.gross) : '—'}</dd>
          </div>
        </dl>

        {/* Vacation periods (timeline) */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            {t('employees.vacation.periods', { year })}
          </p>
          {!connected ? (
            <p className="text-sm text-muted-foreground">{t('employees.vacation.notConnected')}</p>
          ) : loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('employees.vacation.loading')}</p>
          ) : error ? (
            <p className="text-sm text-amber-600">{t('employees.vacation.fetchError')}</p>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('employees.vacation.noPeriods', { year })}</p>
          ) : (
            <div className="space-y-1.5">
              {sorted.map((v, i) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      {formatDate(v.start)} → {formatDate(v.end)}
                      {i === 0 && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">1/{sorted.length}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{t('employees.vacation.days', { count: countVacationDays(v.dates) })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment state: paid banner OR generate button (once per year) */}
        {payment ? (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">{t('employees.vacation.paid')} ✓</p>
              <p className="text-xs text-emerald-700">
                {t('employees.vacation.paidDetail', {
                  date: formatDate(payment.date.slice(0, 10)),
                  days: payment.days,
                  amount: fmt(payment.amount),
                })}
              </p>
            </div>
          </div>
        ) : (
          <Button onClick={() => setShowReceipt(true)} className="gap-1.5">
            <FileText className="h-4 w-4" /> {t('employees.vacation.generateReceipt')}
          </Button>
        )}

        {/* Vacation ISR status */}
        {isr && isr.amount > 0 && (
          isr.appliedInPeriod === null ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <Clock className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="text-xs font-medium text-amber-700">
                {t('employees.vacation.isrPending', { amount: fmt(isr.amount) })}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700">
                {t('employees.vacation.isrApplied', { period: isr.appliedInPeriod })} ✓
              </span>
            </div>
          )
        )}
      </CardContent>

      {showReceipt && (
        <VacationReceiptModal
          employee={employee}
          country={country}
          payRate={employee.payRate}
          entitledDays={entitledDays}
          daysTaken={firstReq ? firstReqDaysTaken : undefined}
          periodLabel={firstReqLabel}
          onConfirm={(p) => {
            markPaid(employee.id, year, p)
            if (p.isrAmount > 0) {
              setPendingIsr(employee.id, {
                amount: p.isrAmount,
                vacationReceiptId: `vac-${employee.id}-${year}`,
                approvedDate: p.date.slice(0, 10),
                vacationPeriod: p.periodLabel ?? firstReqLabel ?? '',
                appliedInPeriod: null,
              })
            }
            setShowReceipt(false)
          }}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </Card>
  )
}
