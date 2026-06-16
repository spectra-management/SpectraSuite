import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, CalendarDays, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSettingsStore } from '@/store/settingsStore'
import { useEmployeesStore } from '@/store/employeesStore'
import { toast } from '@/hooks/useToast'
import { fetchHoursForPeriod, fetchUserProfiles } from '@/lib/connectors/hubstaff'
import type { HubstaffActivityUser } from '@/lib/connectors/hubstaff'
import { roundHalfUp, standardPeriodHours } from '@/lib/payroll/calculations'
import { cn } from '@/lib/utils'
import type { Employee, EmployeeHoursEntry } from '@/types'

interface Props {
  onNext: (data: {
    startDate: string
    endDate: string
    frequency: 'biweekly' | 'weekly'
    employeeHours: EmployeeHoursEntry[]
    country: string
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

// Last day of month (handles Feb leap years)
function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

// Build YYYY-MM-DD string
function toISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function countryFlag(country: string): string {
  const c = country.toLowerCase().trim()
  if (c.includes('dominican')) return '🇩🇴'
  if (c.includes('united states') || c === 'us') return '🇺🇸'
  if (c.includes('jamaica')) return '🇯🇲'
  if (c.includes('philippines') || c.includes('filipinas')) return '🇵🇭'
  if (c.includes('kenya')) return '🇰🇪'
  if (c.includes('mexico') || c.includes('méxico')) return '🇲🇽'
  if (c.includes('haiti')) return '🇭🇹'
  if (c.includes('puerto rico')) return '🇵🇷'
  if (c.includes('canada')) return '🇨🇦'
  if (c.includes('colombia')) return '🇨🇴'
  if (c.includes('venezuela')) return '🇻🇪'
  if (c.includes('panama') || c.includes('panamá')) return '🇵🇦'
  if (c.includes('costa rica')) return '🇨🇷'
  if (c.includes('cuba')) return '🇨🇺'
  return '🌍'
}

function countryLabel(country: string): string {
  if (!country) return 'Unknown'
  return country
}

export function StepPeriod({ onNext }: Props) {
  const { t, i18n } = useTranslation()
  const payrollSettings = useSettingsStore((s) => s.payroll)
  const hubstaff = useSettingsStore((s) => s.hubstaff)
  const updateHubstaff = useSettingsStore((s) => s.updateHubstaff)
  const employees = useEmployeesStore((s) => s.employees)

  const today = new Date()
  const [frequency, setFrequency] = useState<'biweekly' | 'weekly'>(payrollSettings.frequency)

  // ── Country selection ────────────────────────────────────────────────────────
  // All active employees (Hourly + Salary) determine which countries appear
  const availableCountries = useMemo(() => {
    const active = employees.filter((e) => e.status === 'Active')
    const countryMap = new Map<string, number>()
    for (const emp of active) {
      const c = emp.country && emp.country.trim() ? emp.country.trim() : 'Unknown'
      countryMap.set(c, (countryMap.get(c) ?? 0) + 1)
    }
    // Sort: Dominican Republic first, then US, then Unknown
    const sorted = [...countryMap.entries()].sort(([a], [b]) => {
      const priority = (s: string) => {
        if (s.toLowerCase().includes('dominican')) return 0
        if (s.toLowerCase().includes('united states') || s === 'us') return 1
        if (s === 'Unknown') return 3
        return 2
      }
      return priority(a) - priority(b)
    })
    return sorted
  }, [employees])

  const defaultCountry = useMemo(() => {
    if (availableCountries.length === 0) return 'Dominican Republic'
    return availableCountries[0][0]
  }, [availableCountries])

  const [selectedCountry, setSelectedCountry] = useState<string>(defaultCountry)

  // Unknown count for warning message
  const unknownCount = useMemo(() => {
    const found = availableCountries.find(([c]) => c === 'Unknown')
    return found ? found[1] : 0
  }, [availableCountries])

  // ── Biweekly picker state ──────────────────────────────────────────────────
  const [bwYear, setBwYear] = useState(today.getFullYear())
  const [bwMonth, setBwMonth] = useState(today.getMonth()) // 0-indexed
  const [bwQuincena, setBwQuincena] = useState<1 | 2>(today.getDate() <= 15 ? 1 : 2)

  const bwDates = useMemo(() => {
    if (bwQuincena === 1) {
      return { start: toISODate(bwYear, bwMonth, 1), end: toISODate(bwYear, bwMonth, 15) }
    }
    const last = lastDayOfMonth(bwYear, bwMonth)
    return { start: toISODate(bwYear, bwMonth, 16), end: toISODate(bwYear, bwMonth, last) }
  }, [bwYear, bwMonth, bwQuincena])

  // ── Weekly free-form date state ────────────────────────────────────────────
  const defaultWeeklyEnd = today.toISOString().split('T')[0]
  const defaultWeeklyStart = new Date(today.getTime() - 6 * 86400000).toISOString().split('T')[0]
  const [weeklyStart, setWeeklyStart] = useState(defaultWeeklyStart)
  const [weeklyEnd, setWeeklyEnd] = useState(defaultWeeklyEnd)

  // ── Custom dates toggle (biweekly only) ───────────────────────────────────
  const [useCustomDates, setUseCustomDates] = useState(false)
  const [customStart, setCustomStart] = useState(bwDates.start)
  const [customEnd, setCustomEnd] = useState(bwDates.end)

  const handleToggleCustomDates = () => {
    if (!useCustomDates) {
      setCustomStart(bwDates.start)
      setCustomEnd(bwDates.end)
    }
    setUseCustomDates((v) => !v)
  }

  // ── Effective dates passed to fetch ───────────────────────────────────────
  const effectiveStart = frequency === 'biweekly'
    ? (useCustomDates ? customStart : bwDates.start)
    : weeklyStart
  const effectiveEnd = frequency === 'biweekly'
    ? (useCustomDates ? customEnd : bwDates.end)
    : weeklyEnd

  // ── Month name list (locale-aware) ────────────────────────────────────────
  const monthNames = useMemo(() =>
    Array.from({ length: 12 }, (_, i) =>
      new Intl.DateTimeFormat(i18n.language || 'en', { month: 'long' })
        .format(new Date(2024, i, 1)),
    ),
    [i18n.language],
  )

  const yearOptions = useMemo(() => {
    const y = today.getFullYear()
    return [y - 1, y, y + 1]
  }, [])

  const [loading, setLoading] = useState(false)

  const handleFetch = async () => {
    if (!effectiveStart || !effectiveEnd) {
      toast({ variant: 'destructive', title: t('errors.required') })
      return
    }
    if (effectiveStart > effectiveEnd) {
      toast({ variant: 'destructive', title: 'Start date must be before end date' })
      return
    }

    // All active employees for the selected country (Hourly + Salary)
    const activeEmployees = employees.filter((e) => {
      if (e.status !== 'Active') return false
      const empCountry = e.country && e.country.trim() ? e.country.trim() : 'Unknown'
      return empCountry === selectedCountry
    })

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
          effectiveStart,
          effectiveEnd,
          payrollSettings.otThresholdHours,
          frequency,
        )
        hoursMap = result.hoursMap
        hubUsers = result.users

        const { tokenUpdate } = result
        const postFetchState = {
          refreshToken: tokenUpdate.newRefreshToken ?? hubstaff.refreshToken,
          cachedAccessToken: tokenUpdate.newAccessToken ?? hubstaff.cachedAccessToken,
          cachedAccessTokenExpiry: tokenUpdate.newAccessTokenExpiry ?? hubstaff.cachedAccessTokenExpiry,
        }
        if (tokenUpdate.newRefreshToken || tokenUpdate.newAccessToken) {
          updateHubstaff({
            ...(tokenUpdate.newRefreshToken ? { refreshToken: tokenUpdate.newRefreshToken } : {}),
            ...(tokenUpdate.newAccessToken ? { cachedAccessToken: tokenUpdate.newAccessToken } : {}),
            ...(tokenUpdate.newAccessTokenExpiry ? { cachedAccessTokenExpiry: tokenUpdate.newAccessTokenExpiry } : {}),
          })
        }

        if (hubUsers.length === 0 && Object.keys(hoursMap).length > 0) {
          const userIds = Object.keys(hoursMap).map(Number)
          console.log(`[StepPeriod] activities users array empty — fetching ${userIds.length} profiles via /v2/users/{id}`)
          const profiles = await fetchUserProfiles(userIds, postFetchState)
          hubUsers = [...profiles.entries()].map(([id, p]) => ({ id, name: p.name, email: p.email }))
          console.log(`[StepPeriod] profiles fetched: ${hubUsers.length}`, hubUsers.map(u => ({ id: u.id, name: u.name, email: u.email })))
        }

        console.log('[StepPeriod] BambooHR active employees:', activeEmployees.map((e) => ({
          name: `${e.firstName} ${e.lastName}`, email: e.workEmail,
        })))
        console.log('[StepPeriod] hoursMap user IDs:', Object.keys(hoursMap).length, 'hubUsers for matching:', hubUsers.length)
      } catch (err) {
        const msg = err instanceof Error ? err.message : t('errors.fetchFailed')
        toast({ variant: 'destructive', title: 'Hubstaff fetch failed', description: msg + ' — proceeding with manual entry.' })
      }
    }

    const employeeHours: EmployeeHoursEntry[] = activeEmployees.map((emp) => {
      const savedMapping = hubstaff.employeeMapping.find((m) => m.bambooEmployeeId === emp.id)
      let hubstaffUserId: string | undefined = savedMapping?.hubstaffUserId || undefined
      let hubstaffData = hubstaffUserId ? hoursMap[hubstaffUserId] : undefined

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

      // Salary employees don't track hours in Hubstaff — pay is fixed. Auto-fill the
      // period's standard scheduled hours so they don't show as "Zero Hours".
      const isSalary = emp.payType === 'Salary'
      const salaryHours = isSalary ? standardPeriodHours(effectiveStart, effectiveEnd) : 0

      return {
        employeeId: emp.id,
        hubstaffUserId,
        regularHours: isSalary ? salaryHours : roundHalfUp(hubstaffData?.regular ?? 0, 2),
        otHours: isSalary ? 0 : roundHalfUp(hubstaffData?.ot ?? 0, 2),
        holidayHours: 0,
        source: hubstaffData ? 'hubstaff' : 'manual',
        editedManually: false,
      }
    })

    setLoading(false)
    onNext({ startDate: effectiveStart, endDate: effectiveEnd, frequency, employeeHours, country: selectedCountry })
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

        {/* Country selector */}
        {availableCountries.length > 0 && (
          <div className="space-y-1.5">
            <Label>{t('payroll.selectCountry')}</Label>
            <div className="flex flex-col gap-2">
              {availableCountries.map(([country, count]) => (
                <button
                  key={country}
                  type="button"
                  onClick={() => setSelectedCountry(country)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                    selectedCountry === country
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                      : country === 'Unknown'
                        ? 'border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                  )}
                >
                  <div className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                    selectedCountry === country ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300',
                  )}>
                    {selectedCountry === country && (
                      <div className="h-1.5 w-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span className="text-base leading-none">{countryFlag(country)}</span>
                  <span className="font-medium leading-tight flex-1">{countryLabel(country)}</span>
                  <span className="text-xs text-gray-400">{count} {t('common.employees')}</span>
                </button>
              ))}
            </div>
            {unknownCount > 0 && selectedCountry === 'Unknown' && (
              <p className="text-xs text-amber-600 mt-1">
                {t('payroll.unknownCountryWarning', { count: unknownCount })}
              </p>
            )}
          </div>
        )}

        {/* Frequency selector */}
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

        {/* Biweekly: quincena picker */}
        {frequency === 'biweekly' ? (
          <div className="space-y-4">
            {/* Month + Year */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('payroll.period.selectMonth')}</Label>
                <Select
                  value={String(bwMonth)}
                  onValueChange={(v) => setBwMonth(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((name, idx) => (
                      <SelectItem key={idx} value={String(idx)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('payroll.period.selectYear')}</Label>
                <Select
                  value={String(bwYear)}
                  onValueChange={(v) => setBwYear(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quincena toggle */}
            <div className="space-y-1.5">
              <Label>Quincena</Label>
              <div className="grid grid-cols-2 gap-2">
                {([1, 2] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setBwQuincena(q)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl border px-4 py-3 text-left text-sm transition-colors',
                      bwQuincena === q
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                    )}
                  >
                    <div className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2',
                      bwQuincena === q ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300',
                    )}>
                      {bwQuincena === q && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <span className="font-medium leading-tight">
                      {q === 1 ? t('payroll.period.quincena1') : t('payroll.period.quincena2')}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Computed period display — hidden when custom dates active */}
            {!useCustomDates && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CalendarDays className="h-4 w-4 text-emerald-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 mb-0.5">
                    {t('payroll.period.selectedPeriod')}
                  </p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <span>{bwDates.start}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{bwDates.end}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Custom date inputs */}
            {useCustomDates && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t('payroll.period.startDate')}</Label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('payroll.period.endDate')}</Label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Toggle link */}
            <button
              type="button"
              onClick={handleToggleCustomDates}
              className="text-xs text-gray-400 hover:text-emerald-600 underline underline-offset-2 transition-colors self-start"
            >
              {useCustomDates ? t('payroll.period.useQuincenaPicker') : t('payroll.period.useCustomDates')}
            </button>
          </div>
        ) : (
          /* Weekly: free date inputs */
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('payroll.period.startDate')}</Label>
              <Input
                type="date"
                value={weeklyStart}
                onChange={(e) => setWeeklyStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('payroll.period.endDate')}</Label>
              <Input
                type="date"
                value={weeklyEnd}
                onChange={(e) => setWeeklyEnd(e.target.value)}
              />
            </div>
          </div>
        )}

        {!hubstaff.connected && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            {t('payroll.hubstaffNotConnected')}
          </div>
        )}

        <Button onClick={handleFetch} disabled={loading} className="w-full">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('payroll.period.fetchData')}
        </Button>
      </CardContent>
    </Card>
  )
}
