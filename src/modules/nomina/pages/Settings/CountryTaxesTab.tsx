import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, RotateCcw, Save } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useCountryFiscalStore } from '@/shared/store/countryFiscalStore'
import { generateId } from '@/shared/lib/utils'
import { toast } from '@/shared/hooks/useToast'
import type { CountryDeduction, CountryFiscalConfig, ISRBracket } from '@/shared/types'

const num = (v: string): number => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

export function CountryTaxesTab() {
  const { t } = useTranslation()
  const byCountry = useCountryFiscalStore((s) => s.byCountry)
  const setConfig = useCountryFiscalStore((s) => s.setConfig)
  const resetConfig = useCountryFiscalStore((s) => s.resetConfig)

  const keys = Object.keys(byCountry).sort((a, b) => byCountry[a].country.localeCompare(byCountry[b].country))
  const [selected, setSelected] = useState<string>(keys[0] ?? '')
  const stored = byCountry[selected]
  const [draft, setDraft] = useState<CountryFiscalConfig | null>(stored ?? null)

  useEffect(() => {
    setDraft(byCountry[selected] ?? null)
  }, [selected, byCountry])

  if (!draft) {
    return (
      <Card>
        <CardHeader><CardTitle>{t('settings.countryTaxes.title')}</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">{t('settings.countryTaxes.none')}</p></CardContent>
      </Card>
    )
  }

  const patch = (p: Partial<CountryFiscalConfig>) => setDraft((d) => (d ? { ...d, ...p } : d))

  const updateDeduction = (i: number, p: Partial<CountryDeduction>) =>
    patch({ deductions: draft.deductions.map((d, di) => (di === i ? { ...d, ...p } : d)) })
  const addDeduction = () =>
    patch({ deductions: [...draft.deductions, { id: generateId(), name: '', rate: 0, capBase: null, enabled: true }] })
  const removeDeduction = (i: number) =>
    patch({ deductions: draft.deductions.filter((_, di) => di !== i) })

  const updateBracket = (i: number, p: Partial<ISRBracket>) =>
    patch({ incomeTaxBrackets: draft.incomeTaxBrackets.map((b, bi) => (bi === i ? { ...b, ...p } : b)) })
  const addBracket = () =>
    patch({ incomeTaxBrackets: [...draft.incomeTaxBrackets, { minAmount: 0, maxAmount: null, rate: 0, fixedAmount: 0 }] })
  const removeBracket = (i: number) =>
    patch({ incomeTaxBrackets: draft.incomeTaxBrackets.filter((_, bi) => bi !== i) })

  const save = () => {
    setConfig(selected, draft)
    toast({ variant: 'success', title: t('settings.countryTaxes.saved') })
  }
  const reset = () => {
    resetConfig(selected)
    toast({ title: t('settings.countryTaxes.reset') })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.countryTaxes.title')}</CardTitle>
          <CardDescription>{t('settings.countryTaxes.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('settings.countryTaxes.country')}</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {keys.map((k) => <SelectItem key={k} value={k}>{byCountry[k].country}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />{t('settings.countryTaxes.resetBtn')}
            </Button>
            <Button size="sm" onClick={save}>
              <Save className="mr-1.5 h-3.5 w-3.5" />{t('common.save')}
            </Button>
          </div>
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            {t('settings.countryTaxes.disclaimer')}
          </p>
        </CardContent>
      </Card>

      {/* Statutory deductions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.countryTaxes.deductions')}</CardTitle>
          <CardDescription>{t('settings.countryTaxes.deductionsHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden grid-cols-[auto_1fr_5rem_7rem_7rem_auto] items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
            <span>{t('settings.countryTaxes.on')}</span>
            <span>{t('settings.countryTaxes.name')}</span>
            <span>{t('settings.countryTaxes.rate')}</span>
            <span>{t('settings.countryTaxes.cap')}</span>
            <span>{t('settings.countryTaxes.fixed')}</span>
            <span />
          </div>
          {draft.deductions.map((d, i) => (
            <div key={d.id} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[auto_1fr_5rem_7rem_7rem_auto]">
              <Switch checked={d.enabled} onCheckedChange={(v) => updateDeduction(i, { enabled: v })} />
              <Input value={d.name} placeholder={t('settings.countryTaxes.name')} onChange={(e) => updateDeduction(i, { name: e.target.value })} />
              <Input type="number" step="0.01" value={d.rate} onChange={(e) => updateDeduction(i, { rate: num(e.target.value) })} />
              <Input
                type="number" step="0.01" placeholder="—"
                value={d.capBase ?? ''}
                onChange={(e) => updateDeduction(i, { capBase: e.target.value === '' ? null : num(e.target.value) })}
              />
              <Input
                type="number" step="0.01" placeholder="—"
                value={d.fixedAmount ?? ''}
                onChange={(e) => updateDeduction(i, { fixedAmount: e.target.value === '' ? undefined : num(e.target.value) })}
              />
              <Button variant="ghost" size="icon" onClick={() => removeDeduction(i)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addDeduction}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />{t('settings.countryTaxes.addDeduction')}
          </Button>
        </CardContent>
      </Card>

      {/* Income tax */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.countryTaxes.incomeTax')}</CardTitle>
          <CardDescription>{t('settings.countryTaxes.incomeTaxHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 sm:max-w-xs">
            <Label className="text-xs text-muted-foreground">{t('settings.countryTaxes.incomeTaxName')}</Label>
            <Input value={draft.incomeTaxName} onChange={(e) => patch({ incomeTaxName: e.target.value })} />
          </div>
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_1fr_5rem_1fr_auto] items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
              <span>{t('settings.countryTaxes.from')}</span>
              <span>{t('settings.countryTaxes.to')}</span>
              <span>{t('settings.countryTaxes.rate')}</span>
              <span>{t('settings.countryTaxes.fixedTax')}</span>
              <span />
            </div>
            {draft.incomeTaxBrackets.map((b, i) => (
              <div key={i} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_1fr_5rem_1fr_auto]">
                <Input type="number" value={b.minAmount} onChange={(e) => updateBracket(i, { minAmount: num(e.target.value) })} />
                <Input
                  type="number" placeholder="∞"
                  value={b.maxAmount ?? ''}
                  onChange={(e) => updateBracket(i, { maxAmount: e.target.value === '' ? null : num(e.target.value) })}
                />
                <Input type="number" step="0.01" value={b.rate} onChange={(e) => updateBracket(i, { rate: num(e.target.value) })} />
                <Input type="number" step="0.01" value={b.fixedAmount} onChange={(e) => updateBracket(i, { fixedAmount: num(e.target.value) })} />
                <Button variant="ghost" size="icon" onClick={() => removeBracket(i)}>
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addBracket}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />{t('settings.countryTaxes.addBracket')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
