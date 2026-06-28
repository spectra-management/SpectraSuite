import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePayrollStore } from '@/shared/store/payrollStore'
import { RateBadge } from '@/shared/components/RateBadge'
import { PayrollStepper } from './components/PayrollStepper'
import { StepPeriod } from './components/StepPeriod'
import { StepHours } from './components/StepHours'
import { StepCalculate } from './components/StepCalculate'
import { StepApprove } from './components/StepApprove'
import type { EmployeeHoursEntry, PayrollEntry, PayrollTotals } from '@/shared/types'

interface PeriodData {
  startDate: string
  endDate: string
  frequency: 'biweekly' | 'weekly' | 'full_month'
  employeeHours: EmployeeHoursEntry[]
  country: string
}

interface CalculatedData {
  entries: PayrollEntry[]
  totals: PayrollTotals
}

export default function Payroll() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const reopenId = searchParams.get('reopenId')
  const getPayroll = usePayrollStore((s) => s.getPayroll)

  const [step, setStep] = useState(0)
  const [periodData, setPeriodData] = useState<PeriodData | null>(null)
  const [reviewedHours, setReviewedHours] = useState<EmployeeHoursEntry[]>([])
  const [calculatedData, setCalculatedData] = useState<CalculatedData | null>(null)
  const [selectedCountry, setSelectedCountry] = useState('')
  // When set, re-approving UPDATES this existing run instead of creating a new one.
  const [reopenedId, setReopenedId] = useState<string | null>(null)

  // Reopen flow: load an approved run, restore its per-employee hours, and jump to the
  // Review Hours step so the user can edit, recalculate and re-approve the SAME run.
  useEffect(() => {
    if (!reopenId) return
    const run = getPayroll(reopenId)
    if (!run) return
    const hours = run.entries.map((e) => e.hours)
    setPeriodData({
      startDate: run.startDate,
      endDate: run.endDate,
      frequency: run.frequency,
      employeeHours: hours,
      country: run.country ?? '',
    })
    setSelectedCountry(run.country ?? '')
    setReviewedHours(hours)
    setReopenedId(reopenId)
    setStep(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reopenId])

  const steps = [
    { key: 'period', label: t('payroll.steps.selectPeriod') },
    { key: 'hours', label: t('payroll.steps.reviewHours') },
    { key: 'calculate', label: t('payroll.steps.calculatePayroll') },
    { key: 'approve', label: t('payroll.steps.approve') },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('payroll.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('payroll.subtitle')}</p>
        </div>
        <RateBadge country={selectedCountry || undefined} className="shrink-0" />
      </div>

      <PayrollStepper steps={steps} currentStep={step} />

      {step === 0 && (
        <StepPeriod
          onNext={(data) => {
            setPeriodData(data)
            setSelectedCountry(data.country)
            setReviewedHours(data.employeeHours)
            setStep(1)
          }}
        />
      )}

      {step === 1 && periodData && (
        <StepHours
          employeeHours={reviewedHours}
          startDate={periodData.startDate}
          endDate={periodData.endDate}
          frequency={periodData.frequency}
          country={selectedCountry}
          onNext={(hours) => {
            setReviewedHours(hours)
            setStep(2)
          }}
          onBack={() => setStep(0)}
        />
      )}

      {step === 2 && periodData && (
        <StepCalculate
          employeeHours={reviewedHours}
          startDate={periodData.startDate}
          endDate={periodData.endDate}
          frequency={periodData.frequency}
          country={selectedCountry}
          onNext={(entries, totals) => {
            setCalculatedData({ entries, totals })
            setStep(3)
          }}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && periodData && calculatedData && (
        <StepApprove
          startDate={periodData.startDate}
          endDate={periodData.endDate}
          frequency={periodData.frequency}
          country={selectedCountry}
          entries={calculatedData.entries}
          totals={calculatedData.totals}
          reopenId={reopenedId}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  )
}
