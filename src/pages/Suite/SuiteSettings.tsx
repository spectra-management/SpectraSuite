import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft, Upload } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSettingsStore } from '@/store/settingsStore'
import { toast } from '@/hooks/useToast'
import { Toaster } from '@/components/ui/toaster'
import { UserMenu } from '@/components/layout/UserMenu'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UsersPanel } from './components/UsersPanel'

export default function SuiteSettings() {
  const { t, i18n } = useTranslation()
  const company = useSettingsStore((s) => s.company)
  const updateCompany = useSettingsStore((s) => s.updateCompany)
  const [form, setForm] = useState(company)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en'

  useEffect(() => { document.title = `${t('suite.settings.title')} | Spectra Suite` }, [t])

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
    <div className="min-h-screen bg-canvas">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-6 py-4">
          <Link to="/suite" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400">
            <ArrowLeft className="h-4 w-4" /> {t('suite.backToSuite')}
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => i18n.changeLanguage(currentLang === 'en' ? 'es' : 'en')}
              className="font-semibold tracking-wide"
              aria-label="Toggle language"
            >
              {currentLang === 'en' ? 'ES' : 'EN'}
            </Button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-foreground">{t('suite.settings.title')}</h1>

        <Card>
          <CardHeader>
            <CardTitle>{t('suite.settings.companySection')}</CardTitle>
            <CardDescription>{t('settings.company.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-lg">
            {/* Logo */}
            <div className="space-y-1.5">
              <Label>{t('settings.company.logo')}</Label>
              <div className="flex items-center gap-4">
                {form.logoBase64 ? (
                  <img src={form.logoBase64} alt="logo" className="h-14 w-14 rounded-xl object-contain border border-border" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-input bg-secondary text-xl font-bold text-muted-foreground">
                    {form.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    {t('settings.company.logoUpload')}
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">{t('settings.company.logoHelp')}</p>
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

            {/* Brand colors */}
            <div className="space-y-1.5">
              <Label>{t('suite.settings.brandColors')}</Label>
              <div className="flex flex-wrap items-center gap-6">
                <ColorField
                  label={t('suite.settings.primaryColor')}
                  value={form.accentColor}
                  onChange={(v) => setForm((f) => ({ ...f, accentColor: v }))}
                />
                <ColorField
                  label={t('suite.settings.secondaryColor')}
                  value={form.secondaryColor ?? '#065F46'}
                  onChange={(v) => setForm((f) => ({ ...f, secondaryColor: v }))}
                />
              </div>
            </div>

            <Button onClick={handleSave}>{t('common.saveChanges')}</Button>
          </CardContent>
        </Card>

        {/* User management (super_admin only — route is already gated) */}
        <UsersPanel />
      </main>
      <Toaster />
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border border-input p-1"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="w-28 font-mono text-xs" />
      </div>
    </div>
  )
}
