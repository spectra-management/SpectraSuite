import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Plane, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { toast } from '@/shared/hooks/useToast'
import { cn, generateId } from '@/shared/lib/utils'
import {
  VACATION_COUNTRIES, getVacationRules, isVacationConfigured, saveVacationRules,
  defaultVacationRules, type VacationRules, type SeniorityTier,
} from '@/modules/nomina/lib/vacations'

const FLAG: Record<string, string> = {
  'Dominican Republic': '🇩🇴', Mexico: '🇲🇽', 'United States': '🇺🇸',
  Jamaica: '🇯🇲', Philippines: '🇵🇭', Kenya: '🇰🇪',
}

export function VacationRulesTab() {
  const { t, i18n } = useTranslation()
  const dailyDivisor = useSettingsStore((s) => s.fiscal.dailyDivisor)

  const [country, setCountry] = useState<string>(VACATION_COUNTRIES[0])
  const [tick, setTick] = useState(0)
  const [form, setForm] = useState<VacationRules | null>(null)

  // Load the selected country's rules; DR seeds its statutory default (daily divisor
  // synced from Payroll Settings when not yet saved).
  useEffect(() => {
    const r = getVacationRules(country)
    if (r && !r.lastModified) r.formula.dailyDivisor = dailyDivisor
    setForm(r)
  }, [country, dailyDivisor])

  const persist = (next: VacationRules) => {
    const saved = saveVacationRules(country, next)
    setForm(saved)
    setTick((n) => n + 1)
  }

  const handleConfigure = () => {
    persist(defaultVacationRules(country, dailyDivisor))
  }

  const updateTier = (id: string, patch: Partial<SeniorityTier>) =>
    setForm((f) => (f ? { ...f, tiers: f.tiers.map((tr) => (tr.id === id ? { ...tr, ...patch } : tr)) } : f))

  const addTier = () => {
    if (!form) return
    const last = form.tiers[form.tiers.length - 1]
    const min = last ? (last.maxYears ?? last.minYears) + 1 : 1
    persist({ ...form, tiers: [...form.tiers, { id: generateId(), minYears: min, maxYears: null, days: 14 }] })
  }

  const deleteTier = (id: string) => {
    if (!form) return
    persist({ ...form, tiers: form.tiers.filter((tr) => tr.id !== id) })
  }

  const setFormula = (key: keyof VacationRules['formula'], value: number) =>
    setForm((f) => (f ? { ...f, formula: { ...f.formula, [key]: value } } : f))

  const toggleDeduction = (key: keyof VacationRules['deductions'], value: boolean) => {
    if (!form) return
    persist({ ...form, deductions: { ...form.deductions, [key]: value } })
  }

  const fmtModified = form?.lastModified
    ? new Date(form.lastModified).toLocaleString(i18n.language?.startsWith('es') ? 'es-DO' : 'en-US')
    : t('settings.vacations.neverSaved')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.vacations.title')}</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">{t('settings.vacations.subtitle')}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Country tabs with status badges */}
        <div className="flex flex-wrap gap-1.5">
          {VACATION_COUNTRIES.map((c) => {
            void tick
            const configured = isVacationConfigured(c)
            const tierCount = getVacationRules(c)?.tiers.length ?? 0
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCountry(c)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  country === c ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-input text-muted-foreground hover:bg-secondary',
                )}
              >
                <span className="text-sm leading-none">{FLAG[c]}</span>
                {c}
                {configured ? (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700">
                    {tierCount} · {t('settings.vacations.configured')} <Check className="h-2.5 w-2.5" />
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground">
                    {t('settings.vacations.notConfigured')}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {form ? (
          <VacationForm
            t={t}
            form={form}
            fmtModified={fmtModified}
            updateTier={updateTier}
            addTier={addTier}
            deleteTier={deleteTier}
            setFormula={setFormula}
            toggleDeduction={toggleDeduction}
            persist={persist}
          />
        ) : (
          /* Not-configured empty state */
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-input bg-secondary py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary">
              <Plane className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t('settings.vacations.notConfiguredText', { country })}</p>
            <Button onClick={handleConfigure} className="gap-1.5">
              <Plus className="h-4 w-4" />
              {t('settings.vacations.configureBtn')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function VacationForm({
  t, form, fmtModified, updateTier, addTier, deleteTier, setFormula, toggleDeduction, persist,
}: {
  t: (k: string, o?: Record<string, unknown>) => string
  form: VacationRules
  fmtModified: string
  updateTier: (id: string, patch: Partial<SeniorityTier>) => void
  addTier: () => void
  deleteTier: (id: string) => void
  setFormula: (key: keyof VacationRules['formula'], value: number) => void
  toggleDeduction: (key: keyof VacationRules['deductions'], value: boolean) => void
  persist: (next: VacationRules) => void
}) {
  const blurSave = () => persist(form)
  const num = (v: string) => (v === '' ? 0 : Number(v))

  return (
    <div className="space-y-6">
      {/* Seniority tiers */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{t('settings.vacations.tiers')}</p>
          <Button variant="outline" size="sm" onClick={addTier} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> {t('settings.vacations.addTier')}
          </Button>
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2">{t('settings.vacations.colYears')}</th>
                <th className="px-4 py-2 w-32">{t('settings.vacations.colDays')}</th>
                <th className="px-4 py-2 w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {form.tiers.map((tr) => (
                <tr key={tr.id} className="hover:bg-secondary">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number" min={0} className="h-8 w-20"
                        value={tr.minYears}
                        onChange={(e) => updateTier(tr.id, { minYears: num(e.target.value) })}
                        onBlur={blurSave}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="number" min={0} className="h-8 w-20"
                        placeholder="∞"
                        value={tr.maxYears ?? ''}
                        onChange={(e) => updateTier(tr.id, { maxYears: e.target.value === '' ? null : num(e.target.value) })}
                        onBlur={blurSave}
                      />
                      <span className="text-xs text-muted-foreground">{t('settings.vacations.maxYearsOpenHint')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <Input
                      type="number" min={0} className="h-8 w-24"
                      value={tr.days}
                      onChange={(e) => updateTier(tr.id, { days: num(e.target.value) })}
                      onBlur={blurSave}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteTier(tr.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Salary formula */}
      <section className="space-y-3">
        <p className="text-sm font-semibold text-foreground">{t('settings.vacations.formula')}</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <FormulaInput label={t('settings.vacations.hoursPerWeek')} value={form.formula.hoursPerWeek} onChange={(v) => setFormula('hoursPerWeek', v)} onBlur={blurSave} />
          <FormulaInput label={t('settings.vacations.weeksPerYear')} value={form.formula.weeksPerYear} onChange={(v) => setFormula('weeksPerYear', v)} onBlur={blurSave} />
          <FormulaInput label={t('settings.vacations.monthsPerYear')} value={form.formula.monthsPerYear} onChange={(v) => setFormula('monthsPerYear', v)} onBlur={blurSave} />
          <FormulaInput label={t('settings.vacations.dailyDivisor')} value={form.formula.dailyDivisor} step={0.01} onChange={(v) => setFormula('dailyDivisor', v)} onBlur={blurSave} help={t('settings.vacations.dailyDivisorHelp')} />
        </div>
        <div className="rounded-xl border border-border bg-secondary px-4 py-2.5 space-y-1 text-xs text-muted-foreground">
          <p>{t('settings.vacations.formulaLine1')}</p>
          <p>{t('settings.vacations.formulaLine2')}</p>
          <p>{t('settings.vacations.formulaLine3')}</p>
        </div>
      </section>

      {/* Deductions */}
      <section className="space-y-2">
        <p className="text-sm font-semibold text-foreground">{t('settings.vacations.deductions')}</p>
        <div className="space-y-2">
          <ToggleRow label={t('settings.vacations.applySfs')} checked={form.deductions.sfs} onChange={(v) => toggleDeduction('sfs', v)} />
          <ToggleRow label={t('settings.vacations.applyAfp')} checked={form.deductions.afp} onChange={(v) => toggleDeduction('afp', v)} />
          <ToggleRow label={t('settings.vacations.applyIsr')} checked={form.deductions.isr} onChange={(v) => toggleDeduction('isr', v)} />
        </div>
      </section>

      {/* Paystub language (auto) */}
      <section className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">{t('settings.vacations.payStubLanguage')}:</Label>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {form.payStubLanguage === 'es' ? t('settings.vacations.langEs') : t('settings.vacations.langEn')}
        </span>
      </section>

      {/* Save + last modified */}
      <div>
        <Button onClick={() => { persist(form); toast({ variant: 'success', title: t('settings.vacations.saved') }) }}>
          {t('settings.vacations.save')}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">{t('settings.vacations.lastModified', { time: fmtModified })}</p>
      </div>
    </div>
  )
}

function FormulaInput({ label, value, onChange, onBlur, step, help }: {
  label: string; value: number; onChange: (v: number) => void; onBlur: () => void; step?: number; help?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number" min={0} step={step ?? 1}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        onBlur={onBlur}
      />
      {help && <p className="text-[10px] text-muted-foreground">{help}</p>}
    </div>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
