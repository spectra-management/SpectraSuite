import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Loader2, Plug, Link2, Mail, Wand2, Info, ChevronDown, Search } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

import { Separator } from '@/components/ui/separator'
import { useSettingsStore } from '@/store/settingsStore'
import { useEmployeesStore } from '@/store/employeesStore'
import { toast } from '@/hooks/useToast'
import { testHubstaffToken, fetchHubstaffMembers, fetchUserProfiles, normalizeEmail } from '@/lib/connectors/hubstaff'
import type { HubstaffOrganization } from '@/lib/connectors/hubstaff'
import type { HubstaffMember } from '@/lib/connectors/types'
import type { HubstaffMapping } from '@/types'

function ConnectorStatus({ connected, testing }: { connected: boolean; testing: boolean }) {
  const { t } = useTranslation()
  if (testing) {
    return (
      <Badge variant="secondary">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        {t('connectors.status.testing')}
      </Badge>
    )
  }
  if (connected) {
    return (
      <Badge variant="default">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        {t('connectors.status.connected')}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary">
      <XCircle className="mr-1 h-3 w-3" />
      {t('connectors.status.notConfigured')}
    </Badge>
  )
}

function BambooHRConnector() {
  const { t } = useTranslation()
  const bamboohr = useSettingsStore((s) => s.bamboohr)
  const updateBambooHR = useSettingsStore((s) => s.updateBambooHR)
  const [testing, setTesting] = useState(false)

  const handleTest = async () => {
    if (!bamboohr.subdomain || !bamboohr.apiKey) {
      toast({ variant: 'destructive', title: t('errors.apiKeyMissing') })
      return
    }
    setTesting(true)
    try {
      const res = await fetch(
        `/api/bamboohr?path=${encodeURIComponent('/v1/employees/directory')}&subdomain=${encodeURIComponent(bamboohr.subdomain)}&apiKey=${encodeURIComponent(bamboohr.apiKey)}`,
      )
      if (!res.ok) throw new Error(await res.text())
      updateBambooHR({ connected: true })
      toast({ variant: 'success', title: t('connectors.status.connected'), description: t('connectors.bamboohr.connected') })
    } catch (err) {
      updateBambooHR({ connected: false })
      const msg = err instanceof Error ? err.message : t('errors.connectionFailed')
      toast({ variant: 'destructive', title: t('connectors.status.error'), description: msg })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
              <Plug className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <CardTitle className="text-base">{t('connectors.bamboohr.title')}</CardTitle>
              <CardDescription>{t('connectors.bamboohr.description')}</CardDescription>
            </div>
          </div>
          <ConnectorStatus connected={bamboohr.connected} testing={testing} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t('connectors.bamboohr.subdomain')}</Label>
          <div className="flex items-center gap-2">
            <Input
              placeholder={t('connectors.bamboohr.subdomainPlaceholder')}
              value={bamboohr.subdomain}
              onChange={(e) => updateBambooHR({ subdomain: e.target.value, connected: false })}
            />
            <span className="shrink-0 text-sm text-muted-foreground">.bamboohr.com</span>
          </div>
          <p className="text-xs text-muted-foreground">{t('connectors.bamboohr.subdomainHelp')}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t('connectors.bamboohr.apiKey')}</Label>
          <Input
            type="password"
            placeholder={t('connectors.bamboohr.apiKeyPlaceholder')}
            value={bamboohr.apiKey}
            onChange={(e) => updateBambooHR({ apiKey: e.target.value, connected: false })}
          />
          <p className="text-xs text-muted-foreground">{t('connectors.bamboohr.apiKeyHelp')}</p>
        </div>
        <Button onClick={handleTest} disabled={testing} variant="outline">
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.testConnection')}
        </Button>
      </CardContent>
    </Card>
  )
}

// Searchable dropdown — replaces shadcn Select when the option list is large (100+)
interface SearchOption { value: string; label: string; sublabel?: string }

function SearchableSelect({
  value,
  options,
  onChange,
  clearLabel,
  searchPlaceholder = 'Search…',
}: {
  value: string
  options: SearchOption[]
  onChange: (v: string) => void
  clearLabel: string
  searchPlaceholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = query
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.sublabel?.toLowerCase().includes(query.toLowerCase()),
      )
    : options

  const selected = options.find((o) => o.value === value)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-full items-center justify-between gap-1 rounded-md border border-input bg-card px-2 text-xs text-foreground hover:bg-secondary"
      >
        <span className="truncate text-left">{selected ? selected.label : clearLabel}</span>
        <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setQuery('') }} />
          <div className="absolute left-0 top-9 z-20 w-72 overflow-hidden rounded-lg border border-input bg-card shadow-lg">
            {/* Search input */}
            <div className="flex items-center gap-1.5 border-b border-border px-2 py-1.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                type="text"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
            {/* Options list */}
            <div className="max-h-52 overflow-y-auto">
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); setQuery('') }}
                className="w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary"
              >
                {clearLabel}
              </button>
              {filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                  className={[
                    'w-full px-3 py-1.5 text-left text-xs transition-colors',
                    o.value === value ? 'bg-emerald-50 text-emerald-700' : 'text-foreground hover:bg-secondary',
                  ].join(' ')}
                >
                  <p className="font-medium truncate">{o.label}</p>
                  {o.sublabel && <p className="text-[10px] text-muted-foreground truncate">{o.sublabel}</p>}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-2 text-xs text-muted-foreground">No results</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function normalizeForMatch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[n]
}

type MappingView = 'by-hubstaff' | 'by-bamboo'

function HubstaffMappingPanel({ hubstaffMembers }: { hubstaffMembers: HubstaffMember[] }) {
  const { t } = useTranslation()
  const employees = useEmployeesStore((s) => s.employees)
  const hubstaff = useSettingsStore((s) => s.hubstaff)
  const updateHubstaff = useSettingsStore((s) => s.updateHubstaff)
  const [viewMode, setViewMode] = useState<MappingView>('by-hubstaff')

  const hasNames = hubstaffMembers.some((m) => !!m.name)

  const buildInitialMapping = (): HubstaffMapping[] => {
    const saved = hubstaff.employeeMapping
    return hubstaffMembers.map((m) => {
      const existing = saved.find((s) => s.hubstaffUserId === String(m.id))
      if (existing) return existing
      const hubEmail = normalizeEmail(m.email)
      let autoMatch = hubEmail
        ? employees.find((e) => normalizeEmail(e.workEmail) === hubEmail)
        : undefined
      if (!autoMatch && m.name) {
        const hubName = normalizeForMatch(m.name)
        autoMatch = employees.find(
          (e) => normalizeForMatch(`${e.firstName} ${e.lastName}`) === hubName,
        )
      }
      return { hubstaffUserId: String(m.id), bambooEmployeeId: autoMatch?.id ?? '', autoMatched: !!autoMatch }
    })
  }

  const [localMapping, setLocalMapping] = useState<HubstaffMapping[]>(buildInitialMapping)
  const NONE = '__none__'

  // By-Hubstaff view: pick a BambooHR employee for a given Hubstaff user
  const handleHubChange = (hubstaffUserId: string, v: string) => {
    const bambooEmployeeId = v === NONE ? '' : v
    setLocalMapping((prev) =>
      prev.map((m) => m.hubstaffUserId === hubstaffUserId ? { ...m, bambooEmployeeId, autoMatched: false } : m),
    )
  }

  // By-BambooHR view: pick a Hubstaff user for a given BambooHR employee
  const handleBambooChange = (empId: string, v: string) => {
    const selectedHubId = v === NONE ? '' : v
    setLocalMapping((prev) => {
      // Remove this BambooHR employee from whatever Hubstaff slot they were in
      let updated = prev.map((m) =>
        m.bambooEmployeeId === empId ? { ...m, bambooEmployeeId: '', autoMatched: false } : m,
      )
      if (!selectedHubId) return updated
      const idx = updated.findIndex((m) => m.hubstaffUserId === selectedHubId)
      if (idx >= 0) {
        // Update the existing slot for this Hubstaff user
        updated = updated.map((m, i) =>
          i === idx ? { ...m, bambooEmployeeId: empId, autoMatched: false } : m,
        )
      } else {
        // Hubstaff user not in list yet — add new entry
        updated = [...updated, { hubstaffUserId: selectedHubId, bambooEmployeeId: empId, autoMatched: false }]
      }
      return updated
    })
  }

  const handleAutoMatchByName = () => {
    setLocalMapping((prev) =>
      prev.map((m) => {
        if (m.bambooEmployeeId) return m
        const member = hubstaffMembers.find((h) => String(h.id) === m.hubstaffUserId)
        if (!member?.name) return m
        const hubName = normalizeForMatch(member.name)
        const match = employees.find(
          (e) => normalizeForMatch(`${e.firstName} ${e.lastName}`) === hubName,
        )
        return match ? { ...m, bambooEmployeeId: match.id, autoMatched: true } : m
      }),
    )
    toast({ title: t('connectors.hubstaff.autoMatchDone') })
  }

  const handleFuzzyMatch = () => {
    const membersWithNames = hubstaffMembers.filter((h) => !!h.name)
    if (membersWithNames.length === 0) {
      toast({ variant: 'destructive', title: t('connectors.hubstaff.fuzzyNoNames') })
      return
    }
    let matched = 0
    setLocalMapping((prev) => {
      let updated = [...prev]
      for (const emp of unmappedHourly) {
        const empName = normalizeForMatch(`${emp.firstName} ${emp.lastName}`)
        let best: HubstaffMember | undefined
        let bestDist = Infinity
        for (const h of membersWithNames) {
          const d = levenshtein(empName, normalizeForMatch(h.name))
          if (d < bestDist) { bestDist = d; best = h }
        }
        // Accept if distance ≤ 40% of the longer string (tolerates short typos / missing accents)
        const threshold = Math.ceil(Math.max(empName.length, best ? normalizeForMatch(best.name).length : 0) * 0.4)
        if (best && bestDist <= threshold) {
          const hubId = String(best.id)
          updated = updated.map((m) =>
            m.bambooEmployeeId === emp.id ? { ...m, bambooEmployeeId: '', autoMatched: false } : m,
          )
          const idx = updated.findIndex((m) => m.hubstaffUserId === hubId)
          if (idx >= 0) {
            updated = updated.map((m, i) => i === idx ? { ...m, bambooEmployeeId: emp.id, autoMatched: true } : m)
          } else {
            updated = [...updated, { hubstaffUserId: hubId, bambooEmployeeId: emp.id, autoMatched: true }]
          }
          matched++
        }
      }
      return updated
    })
    toast({ title: t('connectors.hubstaff.fuzzyDone', { count: matched }) })
  }

  const handleSave = () => {
    updateHubstaff({ employeeMapping: localMapping })
    toast({ variant: 'success', title: t('connectors.hubstaff.mappingSaved') })
  }

  const activeEmployees = employees.filter((e) => e.status === 'Active')
  const hourlyEmployees = activeEmployees.filter((e) => e.payType === 'Hourly')
  const mappedCount = localMapping.filter((m) => !!m.bambooEmployeeId).length
  const unmappedHourly = hourlyEmployees.filter(
    (e) => !localMapping.some((m) => m.bambooEmployeeId === e.id && m.hubstaffUserId),
  )

  return (
    <div className="space-y-4">
      <Separator />

      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium text-foreground">{t('connectors.hubstaff.mapping')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('connectors.hubstaff.mappingProgress', { mapped: mappedCount, total: localMapping.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasNames && viewMode === 'by-hubstaff' && (
            <Button size="sm" variant="outline" onClick={handleAutoMatchByName}>
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              {t('connectors.hubstaff.autoMatchByName')}
            </Button>
          )}
          {/* View toggle */}
          <div className="flex overflow-hidden rounded-lg border border-input text-xs">
            {(['by-hubstaff', 'by-bamboo'] as MappingView[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setViewMode(v)}
                className={[
                  'relative px-3 py-1.5 font-medium transition-colors',
                  viewMode === v ? 'bg-gray-900 text-white' : 'bg-card text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {v === 'by-hubstaff' ? t('connectors.hubstaff.byHubstaff') : t('connectors.hubstaff.byBamboo')}
                {v === 'by-bamboo' && unmappedHourly.length > 0 && (
                  <span className="ml-1 rounded-full bg-orange-500 px-1.5 py-px text-[10px] font-bold text-white">
                    {unmappedHourly.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Info note (no-names) */}
      {!hasNames && viewMode === 'by-hubstaff' && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
          <Info className="h-3.5 w-3.5 shrink-0 text-blue-500 mt-0.5" />
          <p className="text-xs text-blue-700">{t('connectors.hubstaff.noNamesNote')}</p>
        </div>
      )}

      {/* VIEW A: By Hubstaff User */}
      {viewMode === 'by-hubstaff' && (
        <div className="space-y-2">
          {localMapping.map((m) => {
            const member = hubstaffMembers.find((h) => String(h.id) === m.hubstaffUserId)
            const displayName = member?.name || `User #${m.hubstaffUserId}`
            const bambooOptions: SearchOption[] = activeEmployees.map((e) => ({
              value: e.id,
              label: `${e.firstName} ${e.lastName}`,
              sublabel: e.workEmail,
            }))
            return (
              <div key={m.hubstaffUserId} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  {member?.email && <p className="text-xs text-muted-foreground truncate">{member.email}</p>}
                </div>
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                <div className="w-56">
                  <SearchableSelect
                    value={m.bambooEmployeeId}
                    options={bambooOptions}
                    onChange={(v) => handleHubChange(m.hubstaffUserId, v)}
                    clearLabel={t('connectors.hubstaff.unmatched')}
                    searchPlaceholder={t('connectors.hubstaff.searchBamboo')}
                  />
                </div>
                {m.autoMatched && (
                  <Badge variant="default" className="shrink-0 text-xs">{t('connectors.hubstaff.autoMatched')}</Badge>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* VIEW B: By BambooHR Employee (shows unmapped hourly employees) */}
      {viewMode === 'by-bamboo' && (
        <div className="space-y-3">
          {unmappedHourly.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleFuzzyMatch}>
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              {t('connectors.hubstaff.autoSuggestByName')}
            </Button>
          )}
          <div className="space-y-2">
          {unmappedHourly.length === 0 ? (
            <p className="py-3 text-xs text-muted-foreground">{t('connectors.hubstaff.allMapped')}</p>
          ) : (
            unmappedHourly.map((emp) => {
              const currentHub = localMapping.find(
                (m) => m.bambooEmployeeId === emp.id && m.hubstaffUserId,
              )
              const hubOptions: SearchOption[] = hubstaffMembers.map((h) => ({
                value: String(h.id),
                // "Samantha Douglas — samantha.douglas@spectramanagement.net"
                label: h.name
                  ? (h.email ? `${h.name} — ${h.email}` : h.name)
                  : `User #${h.id}`,
              }))
              return (
                <div key={emp.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {emp.firstName} {emp.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{emp.workEmail}</p>
                  </div>
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  <div className="w-56">
                    <SearchableSelect
                      value={currentHub?.hubstaffUserId ?? ''}
                      options={hubOptions}
                      onChange={(v) => handleBambooChange(emp.id, v)}
                      clearLabel={t('connectors.hubstaff.unmatched')}
                      searchPlaceholder={t('connectors.hubstaff.searchHubstaff')}
                    />
                  </div>
                </div>
              )
            })
          )}
          </div>
        </div>
      )}

      <Button size="sm" onClick={handleSave}>{t('connectors.hubstaff.saveMapping')}</Button>
    </div>
  )
}

function HubstaffConnector() {
  const { t } = useTranslation()
  const hubstaff = useSettingsStore((s) => s.hubstaff)
  const updateHubstaff = useSettingsStore((s) => s.updateHubstaff)
  const [testing, setTesting] = useState(false)
  const [members, setMembers] = useState<HubstaffMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [availableOrgs, setAvailableOrgs] = useState<HubstaffOrganization[]>([])

  useEffect(() => {
    if (hubstaff.connected && hubstaff.refreshToken && hubstaff.organizationId) {
      setLoadingMembers(true)
      fetchHubstaffMembers(hubstaff.organizationId, {
        refreshToken: hubstaff.refreshToken,
        cachedAccessToken: hubstaff.cachedAccessToken,
        cachedAccessTokenExpiry: hubstaff.cachedAccessTokenExpiry,
      })
        .then(async ({ members: fetched, tokenUpdate }) => {
          // Save rotated tokens first so subsequent calls can use the fresh access token
          const postMembersState = {
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

          // If include[]=users didn't return names, batch-fetch via /v2/users/{id}
          // so the mapping panel shows real names instead of "User #ID"
          const noNames = !fetched.some((m) => !!m.name)
          if (noNames && fetched.length > 0) {
            console.log(`[connectors] no names from /members — fetching ${fetched.length} profiles via /v2/users/{id}`)
            const memberIds = fetched.map((m) => m.id)
            const profiles = await fetchUserProfiles(memberIds, postMembersState)
            if (profiles.size > 0) {
              const enriched = fetched.map((m) => {
                const p = profiles.get(m.id)
                return p ? { ...m, name: p.name, email: p.email } : m
              })
              setMembers(enriched)
              console.log(`[connectors] enriched ${profiles.size} member(s) with profile data`)
              return
            }
          }
          setMembers(fetched)
        })
        .catch(() => setMembers([]))
        .finally(() => setLoadingMembers(false))
    }
  }, [hubstaff.connected, hubstaff.refreshToken, hubstaff.organizationId])  // eslint-disable-line react-hooks/exhaustive-deps

  const handleTest = async () => {
    const token = useSettingsStore.getState().hubstaff.refreshToken
    if (!token) {
      toast({ variant: 'destructive', title: t('errors.apiKeyMissing') })
      return
    }
    setTesting(true)
    try {
      const { organizations, tokenUpdate } = await testHubstaffToken({
        refreshToken: token,
        cachedAccessToken: useSettingsStore.getState().hubstaff.cachedAccessToken,
        cachedAccessTokenExpiry: useSettingsStore.getState().hubstaff.cachedAccessTokenExpiry,
      })

      // Save rotated tokens
      updateHubstaff({
        connected: true,
        ...(tokenUpdate.newRefreshToken ? { refreshToken: tokenUpdate.newRefreshToken } : {}),
        ...(tokenUpdate.newAccessToken ? { cachedAccessToken: tokenUpdate.newAccessToken } : {}),
        ...(tokenUpdate.newAccessTokenExpiry ? { cachedAccessTokenExpiry: tokenUpdate.newAccessTokenExpiry } : {}),
      })

      setAvailableOrgs(organizations)
      const orgHint = organizations.length > 0
        ? `${t('connectors.hubstaff.foundOrgs')}: ${organizations.map((o) => `${o.name} (ID: ${o.id})`).join(', ')}`
        : t('connectors.hubstaff.noOrgsFound')
      toast({ variant: 'success', title: t('connectors.status.connected'), description: orgHint })
    } catch (err) {
      updateHubstaff({ connected: false })
      const msg = err instanceof Error ? err.message : t('errors.connectionFailed')
      toast({ variant: 'destructive', title: t('connectors.status.error'), description: msg })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <Plug className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">{t('connectors.hubstaff.title')}</CardTitle>
              <CardDescription>{t('connectors.hubstaff.description')}</CardDescription>
            </div>
          </div>
          <ConnectorStatus connected={hubstaff.connected} testing={testing} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t('connectors.hubstaff.refreshToken')}</Label>
          <Input
            type="password"
            placeholder={t('connectors.hubstaff.refreshTokenPlaceholder')}
            value={hubstaff.refreshToken}
            onChange={(e) => updateHubstaff({ refreshToken: e.target.value, connected: false, cachedAccessToken: undefined, cachedAccessTokenExpiry: undefined })}
          />
          <p className="text-xs text-muted-foreground">{t('connectors.hubstaff.refreshTokenHelp')}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t('connectors.hubstaff.organizationId')}</Label>
          <Input
            placeholder={t('connectors.hubstaff.organizationIdPlaceholder')}
            value={hubstaff.organizationId}
            onChange={(e) => updateHubstaff({ organizationId: e.target.value })}
          />
          {availableOrgs.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-emerald-800">{t('connectors.hubstaff.selectOrg')}</p>
              {availableOrgs.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => updateHubstaff({ organizationId: String(org.id) })}
                  className="flex w-full items-center justify-between rounded-md bg-card px-3 py-1.5 text-xs text-foreground border border-emerald-100 hover:bg-emerald-50 transition-colors"
                >
                  <span className="font-medium">{org.name}</span>
                  <span className="font-mono text-muted-foreground">ID: {org.id}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <Button onClick={handleTest} disabled={testing} variant="outline">
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.testConnection')}
        </Button>

        {hubstaff.connected && (
          loadingMembers ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('connectors.loadingMembers')}
            </div>
          ) : members.length > 0 ? (
            <HubstaffMappingPanel hubstaffMembers={members} />
          ) : null
        )}
      </CardContent>
    </Card>
  )
}

function EmailConnector() {
  const { t } = useTranslation()
  const email = useSettingsStore((s) => s.email)
  const updateEmailConfig = useSettingsStore((s) => s.updateEmailConfig)
  const [testing, setTesting] = useState(false)

  const handleTest = async () => {
    if (!email.resendApiKey || !email.fromEmail) {
      toast({ variant: 'destructive', title: t('errors.apiKeyMissing') })
      return
    }
    setTesting(true)
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email.fromEmail,
          subject: 'Spectra Payroll — Test Email',
          html: '<p>This is a test email from Spectra Payroll.</p>',
          provider: 'resend',
          resendApiKey: email.resendApiKey,
          fromEmail: email.fromEmail,
          fromName: email.fromName,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      updateEmailConfig({ connected: true })
      toast({ variant: 'success', title: t('connectors.email.testSuccess') })
    } catch (err) {
      updateEmailConfig({ connected: false })
      const msg = err instanceof Error ? err.message : t('connectors.email.testError')
      toast({ variant: 'destructive', title: t('connectors.email.testError'), description: msg })
    } finally {
      setTesting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50">
              <Mail className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <CardTitle className="text-base">{t('connectors.email.title')}</CardTitle>
              <CardDescription>{t('connectors.email.description')}</CardDescription>
            </div>
          </div>
          <ConnectorStatus connected={email.connected} testing={testing} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('connectors.email.fromName')}</Label>
            <Input
              placeholder="Spectra Payroll"
              value={email.fromName}
              onChange={(e) => updateEmailConfig({ fromName: e.target.value, connected: false })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('connectors.email.fromEmail')}</Label>
            <Input
              type="email"
              placeholder="payroll@company.com"
              value={email.fromEmail}
              onChange={(e) => updateEmailConfig({ fromEmail: e.target.value, connected: false })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t('connectors.email.apiKey')}</Label>
          <Input
            type="password"
            placeholder="re_..."
            value={email.resendApiKey ?? ''}
            onChange={(e) => updateEmailConfig({ resendApiKey: e.target.value, connected: false })}
          />
        </div>
        <Button onClick={handleTest} disabled={testing} variant="outline">
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('connectors.email.testEmail')}
        </Button>
      </CardContent>
    </Card>
  )
}

function ConnectorsInner() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('connectors.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('connectors.subtitle')}</p>
      </div>
      <div className="grid gap-6 max-w-2xl">
        <BambooHRConnector />
        <HubstaffConnector />
        <EmailConnector />
      </div>
    </div>
  )
}

export default function Connectors() {
  return (
    <ErrorBoundary>
      <ConnectorsInner />
    </ErrorBoundary>
  )
}
