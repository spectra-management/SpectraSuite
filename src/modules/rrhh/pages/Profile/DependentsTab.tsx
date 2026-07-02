import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HeartPulse, Plus, Pencil, Trash2, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { formatDate } from '@/shared/lib/utils'
import { formatCurrency } from '@/shared/lib/utils/currency'
import { useDependentsStore } from '@/shared/store/dependentsStore'
import type { InsuranceDependent, DependentCoverage, DependentRelationship } from '@/shared/types'
import type { RrhhEmployee } from '@/modules/rrhh/types'

const RELATIONSHIPS: DependentRelationship[] = ['spouse', 'child', 'parent', 'other']

const NO_DEPENDENTS: InsuranceDependent[] = []

type FormState = Omit<InsuranceDependent, 'id'>

const EMPTY_FORM: FormState = {
  name: '',
  relationship: 'child',
  nationalId: '',
  birthDate: '',
  gender: '',
  coverage: 'tss',
  monthlyCost: 0,
}

/**
 * Insurance-dependents section of the RRHH employee profile. Two coverage groups,
 * matching the accounting report "Detalle dependientes adicionales":
 * "Dependientes TSS (adicionales)" and "Seguro Complementario".
 */
export function DependentsTab({ employee, canEdit }: { employee: RrhhEmployee; canEdit: boolean }) {
  const { t } = useTranslation()
  const dependents = useDependentsStore((s) => s.byEmployee[employee.id]) ?? NO_DEPENDENTS
  const hydrated = useDependentsStore((s) => s.hydrated)
  const hydrate = useDependentsStore((s) => s.hydrateFromCloud)
  const addDependent = useDependentsStore((s) => s.addDependent)
  const updateDependent = useDependentsStore((s) => s.updateDependent)
  const removeDependent = useDependentsStore((s) => s.removeDependent)

  const [form, setForm] = useState<FormState | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  useEffect(() => {
    if (!hydrated) void hydrate()
  }, [hydrated, hydrate])

  const groups = useMemo(
    () =>
      (['tss', 'complementary'] as DependentCoverage[]).map((coverage) => ({
        coverage,
        deps: dependents.filter((d) => d.coverage === coverage),
      })),
    [dependents],
  )

  const startAdd = (coverage: DependentCoverage) => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, coverage })
  }

  const startEdit = (dep: InsuranceDependent) => {
    const { id, ...rest } = dep
    setEditingId(id)
    setForm(rest)
  }

  const cancelForm = () => {
    setForm(null)
    setEditingId(null)
  }

  const saveForm = () => {
    if (!form || !form.name.trim()) return
    const clean: FormState = { ...form, name: form.name.trim(), monthlyCost: Math.max(0, form.monthlyCost) }
    if (editingId) updateDependent(employee.id, editingId, clean)
    else addDependent(employee.id, clean)
    cancelForm()
  }

  const handleRemove = (dep: InsuranceDependent) => {
    if (!window.confirm(t('rrhh.profile.dependents.deleteConfirm', { name: dep.name }))) return
    removeDependent(employee.id, dep.id)
    if (editingId === dep.id) cancelForm()
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f))

  return (
    <div className="space-y-6">
      {groups.map(({ coverage, deps }) => (
        <Card key={coverage}>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <HeartPulse className="h-4 w-4 text-emerald-600" />
                {t(`rrhh.profile.dependents.group.${coverage}`)}
                <span className="text-xs font-normal text-muted-foreground">({deps.length})</span>
              </CardTitle>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => startAdd(coverage)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {t('rrhh.profile.dependents.add')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className={deps.length === 0 ? undefined : 'p-0'}>
            {deps.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('rrhh.profile.dependents.none')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      {['name', 'relationship', 'nationalId', 'birthDate', 'gender', 'monthlyCost'].map((k) => (
                        <th
                          key={k}
                          className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          {t(`rrhh.profile.dependents.cols.${k}`)}
                        </th>
                      ))}
                      {canEdit && <th className="px-4 py-2.5" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {deps.map((d) => (
                      <tr key={d.id} className="hover:bg-secondary transition-colors">
                        <td className="px-4 py-2.5 font-medium text-foreground">{d.name}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant="secondary">{t(`rrhh.profile.dependents.rel.${d.relationship}`)}</Badge>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">{d.nationalId || '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{d.birthDate ? formatDate(d.birthDate) : '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {d.gender ? t(`rrhh.profile.dependents.gender.${d.gender}`) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {d.monthlyCost > 0 ? formatCurrency(d.monthlyCost, employee.country) : '—'}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-2.5">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => startEdit(d)} title={t('common.edit')}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-red-600 hover:text-red-700" onClick={() => handleRemove(d)} title={t('common.delete')}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Add/edit form */}
      {canEdit && form && (
        <Card className="border-emerald-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {editingId ? t('rrhh.profile.dependents.editTitle') : t('rrhh.profile.dependents.addTitle')}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={cancelForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="dep-name">{t('rrhh.profile.dependents.cols.name')}</Label>
                <Input id="dep-name" value={form.name} onChange={(e) => set('name', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('rrhh.profile.dependents.cols.relationship')}</Label>
                <Select value={form.relationship} onValueChange={(v) => set('relationship', v as DependentRelationship)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((r) => (
                      <SelectItem key={r} value={r}>{t(`rrhh.profile.dependents.rel.${r}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dep-id">{t('rrhh.profile.dependents.cols.nationalId')}</Label>
                <Input id="dep-id" value={form.nationalId} onChange={(e) => set('nationalId', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dep-birth">{t('rrhh.profile.dependents.cols.birthDate')}</Label>
                <Input id="dep-birth" type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t('rrhh.profile.dependents.cols.gender')}</Label>
                <Select value={form.gender || 'unset'} onValueChange={(v) => set('gender', v === 'unset' ? '' : (v as 'M' | 'F'))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">—</SelectItem>
                    <SelectItem value="F">{t('rrhh.profile.dependents.gender.F')}</SelectItem>
                    <SelectItem value="M">{t('rrhh.profile.dependents.gender.M')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('rrhh.profile.dependents.cols.coverage')}</Label>
                <Select value={form.coverage} onValueChange={(v) => set('coverage', v as DependentCoverage)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tss">{t('rrhh.profile.dependents.group.tss')}</SelectItem>
                    <SelectItem value="complementary">{t('rrhh.profile.dependents.group.complementary')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dep-cost">{t('rrhh.profile.dependents.cols.monthlyCost')}</Label>
                <Input
                  id="dep-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.monthlyCost || ''}
                  onChange={(e) => set('monthlyCost', Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={saveForm} disabled={!form.name.trim()}>{t('common.save')}</Button>
              <Button variant="outline" onClick={cancelForm}>{t('common.cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">{t('rrhh.profile.dependents.note')}</p>
    </div>
  )
}
