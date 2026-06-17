import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useSettingsStore } from '@/store/settingsStore'
import { toast } from '@/hooks/useToast'

type Tab = 'company' | 'payroll' | 'fiscal' | 'email'

function CompanyTab() {
  const { t } = useTranslation()
  const company = useSettingsStore((s) => s.company)
  const updateCompany = useSettingsStore((s) => s.updateCompany)
  const [form, setForm] = useState(company)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Logo must be under 2MB' })
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => setForm((f) => ({ ...f, logoBase64: ev.target?.result as string }))
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    updateCompany(form)
    toast({ variant: 'success', title: t('common.success') })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.company.title')}</CardTitle>
        <CardDescription>{t('settings.company.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        <div className="space-y-1.5">
          <Label>{t('settings.company.logo')}</Label>
          <div className="flex items-center gap-4">
            {form.logoBase64 ? (
              <img src={form.logoBase64} alt="logo" className="h-14 w-14 rounded-xl object-contain border border-gray-100" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 text-xl font-bold text-gray-400">
                {form.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {t('settings.company.logoUpload')}
              </Button>
              <p className="mt-1 text-xs text-gray-400">{t('settings.company.logoHelp')}</p>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoChange} />
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t('settings.company.name')}</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('settings.company.rnc')}</Label>
          <Input value={form.rnc} onChange={(e) => setForm((f) => ({ ...f, rnc: e.target.value }))} />
        </div>
        <div className="space-y-1.5">
          <Label>{t('settings.company.address')}</Label>
          <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('settings.company.phone')}</Label>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('settings.company.email')}</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t('settings.company.accentColor')}</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={form.accentColor}
              onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
              className="h-9 w-16 cursor-pointer rounded-lg border border-gray-200 p-1"
            />
            <Input
              value={form.accentColor}
              onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
              className="w-32 font-mono text-xs"
            />
          </div>
          <p className="text-xs text-gray-400">{t('settings.company.accentColorHelp')}</p>
        </div>
        <Button onClick={handleSave}>{t('common.saveChanges')}</Button>
      </CardContent>
    </Card>
  )
}

function PayrollTab() {
  const { t } = useTranslation()
  const payroll = useSettingsStore((s) => s.payroll)
  const updatePayrollSettings = useSettingsStore((s) => s.updatePayrollSettings)
  const nightShift = useSettingsStore((s) => s.nightShift)
  const updateNightShift = useSettingsStore((s) => s.updateNightShift)
  const [form, setForm] = useState(payroll)
  const [nightForm, setNightForm] = useState(nightShift)

  const handleSave = () => {
    updatePayrollSettings(form)
    updateNightShift(nightForm)
    toast({ variant: 'success', title: t('common.success') })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.payroll.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        <div className="space-y-1.5">
          <Label>{t('settings.payroll.frequency')}</Label>
          <Select
            value={form.frequency}
            onValueChange={(v) => setForm((f) => ({ ...f, frequency: v as 'biweekly' | 'weekly' }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="biweekly">{t('settings.payroll.biweekly')}</SelectItem>
              <SelectItem value="weekly">{t('settings.payroll.weekly')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t('settings.payroll.otThreshold')}</Label>
          <Input
            type="number"
            min={0}
            value={form.otThresholdHours}
            onChange={(e) => setForm((f) => ({ ...f, otThresholdHours: Number(e.target.value) }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>{t('settings.payroll.otRate')}</Label>
            <Input
              type="number"
              min={0}
              value={form.otRatePercent}
              onChange={(e) => setForm((f) => ({ ...f, otRatePercent: Number(e.target.value) }))}
            />
            <p className="text-xs text-gray-400">{t('settings.payroll.otRateHelp')}</p>
          </div>
          <div className="space-y-1.5">
            <Label>{t('settings.payroll.holidayRate')}</Label>
            <Input
              type="number"
              min={0}
              value={form.holidayRatePercent}
              onChange={(e) => setForm((f) => ({ ...f, holidayRatePercent: Number(e.target.value) }))}
            />
            <p className="text-xs text-gray-400">{t('settings.payroll.holidayRateHelp')}</p>
          </div>
        </div>

        {/* ── Night shift (15% incentive) ── */}
        <div className="border-t border-gray-100 pt-4 space-y-4">
          <p className="text-sm font-semibold text-gray-900">{t('settings.payroll.nightShiftSection')}</p>

          <div className="space-y-1.5">
            <Label>{t('settings.payroll.nightStart')}</Label>
            <Input
              type="time"
              className="max-w-[160px]"
              value={nightForm.nightStartTime}
              onChange={(e) => setNightForm((f) => ({ ...f, nightStartTime: e.target.value }))}
            />
            <p className="text-xs text-gray-400">{t('settings.payroll.nightStartHelp')}</p>
          </div>

          <div className="space-y-2">
            <Label>{t('settings.payroll.mixedThreshold')}</Label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name="mixedThreshold"
                className="h-4 w-4 accent-emerald-600"
                checked={nightForm.mixedThresholdMode === 'percent'}
                onChange={() => setNightForm((f) => ({ ...f, mixedThresholdMode: 'percent' }))}
              />
              {t('settings.payroll.mixedPercent')}
            </label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="mixedThreshold"
                  className="h-4 w-4 accent-emerald-600"
                  checked={nightForm.mixedThresholdMode === 'hours'}
                  onChange={() => setNightForm((f) => ({ ...f, mixedThresholdMode: 'hours' }))}
                />
                {t('settings.payroll.mixedHours')}
              </label>
              <Input
                type="number"
                min={0}
                step={0.5}
                className="h-8 w-20"
                value={nightForm.mixedThresholdHours}
                disabled={nightForm.mixedThresholdMode !== 'hours'}
                onChange={(e) => setNightForm((f) => ({ ...f, mixedThresholdHours: Number(e.target.value) }))}
              />
            </div>
            <p className="text-xs text-gray-400">{t('settings.payroll.mixedThresholdHelp')}</p>
          </div>
        </div>

        <Button onClick={handleSave}>{t('common.saveChanges')}</Button>
      </CardContent>
    </Card>
  )
}

function FiscalTab() {
  const { t } = useTranslation()
  const fiscal = useSettingsStore((s) => s.fiscal)
  const updateFiscalParameters = useSettingsStore((s) => s.updateFiscalParameters)
  const resetFiscalParameters = useSettingsStore((s) => s.resetFiscalParameters)
  const [form, setForm] = useState(fiscal)

  const handleSave = () => {
    updateFiscalParameters(form)
    toast({ variant: 'success', title: t('common.success') })
  }

  const handleReset = () => {
    resetFiscalParameters()
    setForm({ ...fiscal })
    toast({ title: t('settings.fiscal.resetToDefaults') })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.fiscal.title')}</CardTitle>
        <CardDescription>{t('settings.fiscal.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 max-w-lg">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">TSS</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('settings.fiscal.afpRate')}</Label>
              <Input type="number" step="0.01" value={form.afpRate} onChange={(e) => setForm((f) => ({ ...f, afpRate: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings.fiscal.sfsRate')}</Label>
              <Input type="number" step="0.01" value={form.sfsRate} onChange={(e) => setForm((f) => ({ ...f, sfsRate: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings.fiscal.afpCap')}</Label>
              <Input type="number" value={form.afpCapMultiplier} onChange={(e) => setForm((f) => ({ ...f, afpCapMultiplier: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('settings.fiscal.sfsCap')}</Label>
              <Input type="number" value={form.sfsCapMultiplier} onChange={(e) => setForm((f) => ({ ...f, sfsCapMultiplier: Number(e.target.value) }))} />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>{t('settings.fiscal.minCotizableSalary')}</Label>
          <Input type="number" step="0.01" value={form.minCotizableSalary} onChange={(e) => setForm((f) => ({ ...f, minCotizableSalary: Number(e.target.value) }))} />
          <p className="text-xs text-gray-400">{t('settings.fiscal.minCotizableSalaryHelp')}</p>
        </div>

        <div className="space-y-1.5">
          <Label>{t('settings.fiscal.dailyDivisor')}</Label>
          <Input type="number" step="0.01" value={form.dailyDivisor} onChange={(e) => setForm((f) => ({ ...f, dailyDivisor: Number(e.target.value) }))} />
          <p className="text-xs text-gray-400">{t('settings.fiscal.dailyDivisorHelp')}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">{t('settings.fiscal.isrBrackets')}</p>
          <div className="rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2 text-left text-gray-500">From (RD$)</th>
                  <th className="px-4 py-2 text-left text-gray-500">To (RD$)</th>
                  <th className="px-4 py-2 text-right text-gray-500">Rate (%)</th>
                  <th className="px-4 py-2 text-right text-gray-500">Fixed (RD$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {form.isrBrackets.map((bracket, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2 font-mono text-gray-600">{bracket.minAmount.toLocaleString()}</td>
                    <td className="px-4 py-2 font-mono text-gray-600">
                      {bracket.maxAmount !== null ? bracket.maxAmount.toLocaleString() : '∞'}
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        className="h-6 text-right text-xs w-16 ml-auto"
                        value={bracket.rate}
                        onChange={(e) => {
                          const updated = form.isrBrackets.map((b, bi) =>
                            bi === i ? { ...b, rate: Number(e.target.value) } : b,
                          )
                          setForm((f) => ({ ...f, isrBrackets: updated }))
                        }}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        className="h-6 text-right text-xs w-24 ml-auto"
                        value={bracket.fixedAmount}
                        onChange={(e) => {
                          const updated = form.isrBrackets.map((b, bi) =>
                            bi === i ? { ...b, fixedAmount: Number(e.target.value) } : b,
                          )
                          setForm((f) => ({ ...f, isrBrackets: updated }))
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave}>{t('common.saveChanges')}</Button>
          <Button variant="outline" onClick={handleReset}>{t('settings.fiscal.resetToDefaults')}</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function EmailTab() {
  const { t } = useTranslation()
  const emailTemplate = useSettingsStore((s) => s.emailTemplate)
  const updateEmailTemplate = useSettingsStore((s) => s.updateEmailTemplate)
  const [form, setForm] = useState(emailTemplate)

  const handleSave = () => {
    updateEmailTemplate(form)
    toast({ variant: 'success', title: t('common.success') })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.emailTemplate.title')}</CardTitle>
        <CardDescription>{t('settings.emailTemplate.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-lg">
        <div className="space-y-1.5">
          <Label>{t('settings.emailTemplate.payStubLanguage')}</Label>
          <Select
            value={form.payStubLanguage}
            onValueChange={(v) => setForm((f) => ({ ...f, payStubLanguage: v as 'en' | 'es' }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="es">{t('settings.emailTemplate.spanish')} (Recomendado)</SelectItem>
              <SelectItem value="en">{t('settings.emailTemplate.english')}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-400">{t('settings.emailTemplate.payStubLanguageHelp')}</p>
        </div>
        <div className="space-y-1.5">
          <Label>{t('settings.emailTemplate.subject')}</Label>
          <Input
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{t('settings.emailTemplate.body')}</Label>
          <Textarea
            rows={6}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <p className="text-xs font-medium text-gray-600">{t('settings.emailTemplate.variables')}</p>
          <p className="mt-1 text-xs text-gray-400">{t('settings.emailTemplate.variablesList')}</p>
        </div>
        <Button onClick={handleSave}>{t('common.saveChanges')}</Button>
      </CardContent>
    </Card>
  )
}

export default function Settings() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('company')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'company', label: t('settings.tabs.company') },
    { key: 'payroll', label: t('settings.tabs.payroll') },
    { key: 'fiscal', label: t('settings.tabs.fiscal') },
    { key: 'email', label: t('settings.tabs.email') },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
      </div>
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'company' && <CompanyTab />}
      {activeTab === 'payroll' && <PayrollTab />}
      {activeTab === 'fiscal' && <FiscalTab />}
      {activeTab === 'email' && <EmailTab />}
    </div>
  )
}
