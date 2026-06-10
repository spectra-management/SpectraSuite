import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, XCircle, Loader2, Plug, Link2, Mail } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useSettingsStore } from '@/store/settingsStore'
import { useEmployeesStore } from '@/store/employeesStore'
import { toast } from '@/hooks/useToast'
import { testHubstaffToken, fetchHubstaffMembers } from '@/lib/connectors/hubstaff'
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
            <span className="shrink-0 text-sm text-gray-400">.bamboohr.com</span>
          </div>
          <p className="text-xs text-gray-400">{t('connectors.bamboohr.subdomainHelp')}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t('connectors.bamboohr.apiKey')}</Label>
          <Input
            type="password"
            placeholder={t('connectors.bamboohr.apiKeyPlaceholder')}
            value={bamboohr.apiKey}
            onChange={(e) => updateBambooHR({ apiKey: e.target.value, connected: false })}
          />
          <p className="text-xs text-gray-400">{t('connectors.bamboohr.apiKeyHelp')}</p>
        </div>
        <Button onClick={handleTest} disabled={testing} variant="outline">
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('common.testConnection')}
        </Button>
      </CardContent>
    </Card>
  )
}

function HubstaffMapping({ hubstaffMembers }: { hubstaffMembers: HubstaffMember[] }) {
  const { t } = useTranslation()
  const employees = useEmployeesStore((s) => s.employees)
  const hubstaff = useSettingsStore((s) => s.hubstaff)
  const updateHubstaff = useSettingsStore((s) => s.updateHubstaff)
  const [localMapping, setLocalMapping] = useState<HubstaffMapping[]>(() => {
    const saved = hubstaff.employeeMapping
    const result: HubstaffMapping[] = hubstaffMembers.map((m) => {
      const existing = saved.find((s) => s.hubstaffUserId === String(m.id))
      if (existing) return existing
      const autoMatch = employees.find(
        (e) => e.workEmail.toLowerCase() === m.email.toLowerCase(),
      )
      return {
        hubstaffUserId: String(m.id),
        bambooEmployeeId: autoMatch?.id ?? '',
        autoMatched: !!autoMatch,
      }
    })
    return result
  })

  const handleChange = (hubstaffUserId: string, bambooEmployeeId: string) => {
    setLocalMapping((prev) =>
      prev.map((m) =>
        m.hubstaffUserId === hubstaffUserId
          ? { ...m, bambooEmployeeId, autoMatched: false }
          : m,
      ),
    )
  }

  const handleSave = () => {
    updateHubstaff({ employeeMapping: localMapping })
    toast({ variant: 'success', title: t('connectors.hubstaff.mappingSaved') })
  }

  const activeEmployees = employees.filter((e) => e.status === 'Active')

  return (
    <div className="space-y-4">
      <Separator />
      <div>
        <p className="text-sm font-medium text-gray-900">{t('connectors.hubstaff.mapping')}</p>
        <p className="text-xs text-gray-500 mt-0.5">{t('connectors.hubstaff.mappingSubtitle')}</p>
      </div>
      <div className="space-y-3">
        {localMapping.map((m) => {
          const member = hubstaffMembers.find((h) => String(h.id) === m.hubstaffUserId)
          return (
            <div key={m.hubstaffUserId} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {member?.name ?? m.hubstaffUserId}
                </p>
                <p className="text-xs text-gray-400 truncate">{member?.email}</p>
              </div>
              <Link2 className="h-4 w-4 shrink-0 text-gray-300" />
              <div className="w-56">
                <Select
                  value={m.bambooEmployeeId}
                  onValueChange={(v) => handleChange(m.hubstaffUserId, v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={t('connectors.hubstaff.unmatched')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('connectors.hubstaff.unmatched')}</SelectItem>
                    {activeEmployees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.firstName} {e.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {m.autoMatched && (
                <Badge variant="default" className="shrink-0 text-xs">
                  {t('connectors.hubstaff.autoMatched')}
                </Badge>
              )}
            </div>
          )
        })}
      </div>
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
    if (hubstaff.connected && hubstaff.accessToken && hubstaff.organizationId) {
      setLoadingMembers(true)
      fetchHubstaffMembers(hubstaff.organizationId, hubstaff.accessToken)
        .then(setMembers)
        .catch(() => setMembers([]))
        .finally(() => setLoadingMembers(false))
    }
  }, [hubstaff.connected, hubstaff.accessToken, hubstaff.organizationId])

  const handleTest = async () => {
    if (!hubstaff.accessToken) {
      toast({ variant: 'destructive', title: t('errors.apiKeyMissing') })
      return
    }
    setTesting(true)
    try {
      // Test only the token — hit GET /v2/organizations (no org ID needed)
      const orgs = await testHubstaffToken(hubstaff.accessToken)
      setAvailableOrgs(orgs)
      updateHubstaff({ connected: true })
      const orgHint = orgs.length > 0
        ? `Token valid. Found ${orgs.length} org(s): ${orgs.map((o) => `${o.name} (ID: ${o.id})`).join(', ')}`
        : 'Token valid. No organizations found.'
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
          <Label>{t('connectors.hubstaff.accessToken')}</Label>
          <Input
            type="password"
            placeholder={t('connectors.hubstaff.accessTokenPlaceholder')}
            value={hubstaff.accessToken}
            onChange={(e) => updateHubstaff({ accessToken: e.target.value, connected: false })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('connectors.hubstaff.organizationId')}</Label>
          <Input
            placeholder={t('connectors.hubstaff.organizationIdPlaceholder')}
            value={hubstaff.organizationId}
            onChange={(e) => updateHubstaff({ organizationId: e.target.value })}
          />
          {/* Show available orgs after a successful token test so user can pick the right ID */}
          {availableOrgs.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-emerald-800">Available organizations — click to use:</p>
              {availableOrgs.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => updateHubstaff({ organizationId: String(org.id) })}
                  className="flex w-full items-center justify-between rounded-md bg-white px-3 py-1.5 text-xs text-gray-800 border border-emerald-100 hover:bg-emerald-50 transition-colors"
                >
                  <span className="font-medium">{org.name}</span>
                  <span className="font-mono text-gray-500">ID: {org.id}</span>
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
            <div className="flex items-center gap-2 text-sm text-gray-500 pt-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('connectors.loadingMembers')}
            </div>
          ) : members.length > 0 ? (
            <HubstaffMapping hubstaffMembers={members} />
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

export default function Connectors() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('connectors.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">{t('connectors.subtitle')}</p>
      </div>
      <div className="grid gap-6 max-w-2xl">
        <BambooHRConnector />
        <HubstaffConnector />
        <EmailConnector />
      </div>
    </div>
  )
}
