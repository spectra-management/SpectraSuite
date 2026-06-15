import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSettingsStore } from '@/store/settingsStore'
import { useEmployeesStore } from '@/store/employeesStore'
import { toast } from '@/hooks/useToast'
import { fetchHoursForPeriod } from '@/lib/connectors/hubstaff'
import { roundHalfUp } from '@/lib/payroll/calculations'
import type { EmployeeHoursEntry } from '@/types'

interface Props {
  onNext: (data: {
    startDate: string
    endDate: string
    frequency: 'biweekly' | 'weekly'
    employeeHours: EmployeeHoursEntry[]
  }) => void
}

export function StepPeriod({ onNext }: Props) {
  const { t } = useTranslation()
  const payrollSettings = useSettingsStore((s) => s.payroll)
  const hubstaff = useSettingsStore((s) => s.hubstaff)
  const updateHubstaff = useSettingsStore((s) => s.updateHubstaff)
  const employees = useEmployeesStore((s) => s.employees)

  const today = new Date()
  const defaultEnd = today.toISOString().split('T')[0]
  const defaultStart = new Date(today.getTime() - 13 * 86400000).toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [frequency, setFrequency] = useState<'biweekly' | 'weekly'>(payrollSettings.frequency)
  const [loading, setLoading] = useState(false)

  const handleFetch = async () => {
    if (!startDate || !endDate) {
      toast({ variant: 'destructive', title: t('errors.required') })
      return
    }
    if (startDate > endDate) {
      toast({ variant: 'destructive', title: 'Start date must be before end date' })
      return
    }

    const activeEmployees = employees.filter((e) => e.status === 'Active')
    if (activeEmployees.length === 0) {
      toast({ variant: 'destructive', title: t('payroll.noActiveEmployees') })
      return
    }

    setLoading(true)
    let hoursMap: Record<string, { regular: number; ot: number; total: number }> = {}

    if (hubstaff.connected && hubstaff.refreshToken && hubstaff.organizationId) {
      try {
        const result = await fetchHoursForPeriod(
          hubstaff.organizationId,
          {
            refreshToken: hubstaff.refreshToken,
            cachedAccessToken: hubstaff.cachedAccessToken,
            cachedAccessTokenExpiry: hubstaff.cachedAccessTokenExpiry,
          },
          startDate,
          endDate,
          payrollSettings.otThresholdHours,
          frequency,
        )
        hoursMap = result.hoursMap
        // Save rotated tokens
        const { tokenUpdate } = result
        if (tokenUpdate.newRefreshToken || tokenUpdate.newAccessToken) {
          updateHubstaff({
            ...(tokenUpdate.newRefreshToken ? { refreshToken: tokenUpdate.newRefreshToken } : {}),
            ...(tokenUpdate.newAccessToken ? { cachedAccessToken: tokenUpdate.newAccessToken } : {}),
            ...(tokenUpdate.newAccessTokenExpiry ? { cachedAccessTokenExpiry: tokenUpdate.newAccessTokenExpiry } : {}),
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('errors.fetchFailed')
        toast({ variant: 'destructive', title: 'Hubstaff fetch failed', description: msg + ' — proceeding with manual entry.' })
      }
    }

    const employeeHours: EmployeeHoursEntry[] = activeEmployees.map((emp) => {
      const mapping = hubstaff.employeeMapping.find((m) => m.bambooEmployeeId === emp.id)
      const hubstaffData = mapping ? hoursMap[mapping.hubstaffUserId] : undefined
      return {
        employeeId: emp.id,
        hubstaffUserId: mapping?.hubstaffUserId,
        regularHours: roundHalfUp(hubstaffData?.regular ?? 0, 2),
        otHours: roundHalfUp(hubstaffData?.ot ?? 0, 2),
        holidayHours: 0,
        source: hubstaffData ? 'hubstaff' : 'manual',
        editedManually: false,
      }
    })

    setLoading(false)
    onNext({ startDate, endDate, frequency, employeeHours })
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
            <CalendarDays className="h-5 w-5 text-emerald-600" />
          </div>
          <CardTitle>{t('payroll.period.title')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-1.5">
          <Label>{t('payroll.period.frequency')}</Label>
          <Select
            value={frequency}
            onValueChange={(v) => setFrequency(v as 'biweekly' | 'weekly')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="biweekly">{t('payroll.period.biweekly')}</SelectItem>
              <SelectItem value="weekly">{t('payroll.period.weekly')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('payroll.period.startDate')}</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('payroll.period.endDate')}</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        {!hubstaff.connected && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {t('payroll.hubstaffNotConnected')}
          </div>
        )}
        <Button onClick={handleFetch} disabled={loading || !startDate || !endDate} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {!startDate || !endDate ? t('payroll.period.selectPeriodFirst') : t('payroll.period.fetchData')}
        </Button>
      </CardContent>
    </Card>
  )
}
