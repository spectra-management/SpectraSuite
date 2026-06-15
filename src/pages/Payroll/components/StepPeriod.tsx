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
import type { HubstaffActivityUser } from '@/lib/connectors/hubstaff'
import { roundHalfUp } from '@/lib/payroll/calculations'
import type { Employee, EmployeeHoursEntry } from '@/types'

interface Props {
  onNext: (data: {
    startDate: string
    endDate: string
    frequency: 'biweekly' | 'weekly'
    employeeHours: EmployeeHoursEntry[]
  }) => void
}

function normalizeForMatch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function findHubstaffUserForEmployee(
  emp: Employee,
  hubUsers: HubstaffActivityUser[],
  debug = false,
): HubstaffActivityUser | undefined {
  // a) exact email match
  if (emp.workEmail) {
    const byEmail = hubUsers.find(
      (u) => u.email?.toLowerCase() === emp.workEmail.toLowerCase(),
    )
    if (byEmail) return byEmail
  }
  // b) normalized full-name match
  const empName = normalizeForMatch(`${emp.firstName} ${emp.lastName}`)
  const byName = hubUsers.find((u) => u.name && normalizeForMatch(u.name) === empName)
  if (byName) return byName

  if (debug) {
    console.log(`[match] FAILED for "${emp.firstName} ${emp.lastName}" (${emp.workEmail})`)
    console.log(`  BambooHR normalized name: "${empName}"`)
    console.log(`  Hubstaff users compared (${hubUsers.length} total):`,
      hubUsers.map((u) => ({ id: u.id, name: u.name, normName: u.name ? normalizeForMatch(u.name) : '', email: u.email })),
    )
  }
  return undefined
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

    const activeEmployees = employees.filter(
      (e) => e.status === 'Active' && e.payType === 'Hourly',
    )
    if (activeEmployees.length === 0) {
      toast({ variant: 'destructive', title: t('payroll.noActiveEmployees') })
      return
    }

    setLoading(true)
    let hoursMap: Record<string, { regular: number; ot: number; total: number }> = {}
    let hubUsers: HubstaffActivityUser[] = []

    const missingToken = !hubstaff.refreshToken
    const missingOrg = !hubstaff.organizationId
    const notConnected = !hubstaff.connected

    if (notConnected || missingToken || missingOrg) {
      const reasons = [
        notConnected && 'not connected',
        missingToken && 'no refresh token',
        missingOrg && 'no organization ID',
      ].filter(Boolean).join(', ')
      console.warn('[StepPeriod] Hubstaff fetch skipped:', reasons, {
        connected: hubstaff.connected,
        hasToken: !!hubstaff.refreshToken,
        orgId: hubstaff.organizationId,
      })
      if (!notConnected) {
        // Connected but token/org missing — warn the user visibly
        toast({
          variant: 'destructive',
          title: 'Hubstaff not fully configured',
          description: `Go to Settings → Connectors and reconnect Hubstaff (${reasons}).`,
        })
      }
    }

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
        hubUsers = result.users

        // Diagnostic
        console.log('[StepPeriod] BambooHR hourly employees:', activeEmployees.map((e) => ({
          id: e.id, name: `${e.firstName} ${e.lastName}`, email: e.workEmail,
        })))
        console.log('[StepPeriod] Hubstaff users from activities:', hubUsers)
        console.log('[StepPeriod] hoursMap user IDs:', Object.keys(hoursMap))

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
      // 1. Try saved mapping from Connectors settings
      const savedMapping = hubstaff.employeeMapping.find((m) => m.bambooEmployeeId === emp.id)
      let hubstaffUserId: string | undefined = savedMapping?.hubstaffUserId || undefined
      let hubstaffData = hubstaffUserId ? hoursMap[hubstaffUserId] : undefined

      // 2. On-the-fly match from users embedded in the activities response
      //    (covers the case where Connectors mapping hasn't been configured)
      if (!hubstaffUserId && hubUsers.length > 0) {
        const matched = findHubstaffUserForEmployee(emp, hubUsers, true)
        if (matched) {
          hubstaffUserId = String(matched.id)
          hubstaffData = hoursMap[hubstaffUserId]
          console.log(`[StepPeriod] on-the-fly match: ${emp.firstName} ${emp.lastName} → Hubstaff user ${matched.name} (${matched.id})`)
        }
      }

      if (!hubstaffUserId) {
        console.log(`[StepPeriod] no match: ${emp.firstName} ${emp.lastName} (${emp.workEmail})`)
      }

      return {
        employeeId: emp.id,
        hubstaffUserId,
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
