import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { FileDown, Loader2, Search, Users, Info, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Checkbox } from '@/shared/components/ui/checkbox'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/shared/components/ui/select'
import { toast } from '@/shared/hooks/useToast'
import { cn, generateId } from '@/shared/lib/utils'
import { useAuth } from '@/shared/context/AuthContext'
import { useEmployeesStore } from '@/shared/store/employeesStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { logAuditEvent } from '@/shared/lib/audit'
import { generatePdfBlob, downloadBlob } from '@/shared/lib/pdf'
import { useEmployeeHrStore } from '@/shared/store/employeeHrStore'
import { toCloudEmployee } from '@/shared/connectors/bamboohr-hr'
import type { Employee } from '@/shared/types'
import { useDocumentsStore } from '../../store/documentsStore'
import { CountryScopeSelect } from '../../components/CountryScopeSelect'
import { templateInCountry } from '../../lib/country'
import { buildVariables, fillTemplate } from '../../lib/variables'
import type { GeneratedDocumentRecord } from '../../lib/types'
import type { DocumentPageData, DocumentPageSize } from '../../lib/ContractDocument'

/** Inches → PDF points (72 pt = 1 in). */
const inchesToPoints = (inches: number): number => Math.round(inches * 72)

const ALL_DEPTS = '__all__'

function safeFilePart(s: string): string {
  return s.replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'documento'
}

export default function Generate() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const allTemplates = useDocumentsStore((s) => s.templates)
  const selectedCountry = useDocumentsStore((s) => s.selectedCountry)
  const addRecords = useDocumentsStore((s) => s.addRecords)
  // Templates shown = those for the selected country (or country-agnostic ones).
  const templates = useMemo(
    () => allTemplates.filter((tpl) => templateInCountry(tpl.country, selectedCountry)),
    [allTemplates, selectedCountry],
  )
  const employees = useEmployeesStore((s) => s.employees)
  const company = useSettingsStore((s) => s.company)
  // Rich HR detail (cédula, address, phone, DOB…) read from the cloud-backed store
  // (hydrated on login from the database) — works regardless of BambooHR connectivity.
  const hrById = useEmployeeHrStore((s) => s.byId)
  const upsertEmployee = useEmployeeHrStore((s) => s.upsertEmployee)
  const { profile, user, hasModuleAccess } = useAuth()
  const canGenerate = hasModuleAccess('documentos', 'edit')

  // Manually save a cédula (or correct one) for an employee — stored in the DB and
  // preserved across BambooHR syncs. Lets documents fill even when BambooHR lacks it.
  const saveCedula = (emp: Employee, value: string) => {
    const cedula = value.trim()
    const existing = hrById[emp.id]
    if ((existing?.nationalId ?? '') === cedula) return
    upsertEmployee({ ...(existing ?? toCloudEmployee(emp, undefined)), nationalId: cedula })
    if (cedula) toast({ variant: 'success', title: t('documentos.generate.cedulaSaved') })
  }

  // Only this country's active employees.
  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'Active' && (e.country ?? '') === selectedCountry),
    [employees, selectedCountry],
  )
  const departments = useMemo(
    () => [...new Set(activeEmployees.map((e) => e.department).filter(Boolean))].sort(),
    [activeEmployees],
  )

  const [templateId, setTemplateId] = useState<string>('')
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState<string>(ALL_DEPTS)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState(false)
  // Page size + margin chosen at generation time (override the template default).
  const [pageSize, setPageSize] = useState<DocumentPageSize>('LETTER')
  const [marginIn, setMarginIn] = useState(0.8)

  const hasHrData = Object.keys(hrById).length > 0
  const template = templates.find((tpl) => tpl.id === templateId)

  // Seed the page-size selector from the chosen template (LEGAL → Legal, else Letter);
  // the user can still change it before generating.
  useEffect(() => {
    if (template) setPageSize(template.pageSize === 'LEGAL' ? 'LEGAL' : 'LETTER')
  }, [template])

  const visibleEmployees = useMemo(() => {
    const q = search.trim().toLowerCase()
    return activeEmployees.filter((e) => {
      if (dept !== ALL_DEPTS && e.department !== dept) return false
      if (!q) return true
      return (
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.workEmail.toLowerCase().includes(q) ||
        e.jobTitle.toLowerCase().includes(q)
      )
    })
  }, [activeEmployees, search, dept])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const selectAllVisible = () => setSelected((prev) => new Set([...prev, ...visibleEmployees.map((e) => e.id)]))
  const clearAll = () => setSelected(new Set())

  const selectedEmployees = useMemo(
    () => activeEmployees.filter((e) => selected.has(e.id)),
    [activeEmployees, selected],
  )

  // Live preview of the filled body for the first selected employee.
  const preview = useMemo(() => {
    if (!template || selectedEmployees.length === 0) return null
    const emp = selectedEmployees[0]
    const vars = buildVariables(emp, hrById[emp.id], company, lang, new Date())
    return { name: `${emp.firstName} ${emp.lastName}`, title: fillTemplate(template.title, vars), body: fillTemplate(template.body, vars) }
  }, [template, selectedEmployees, hrById, company, lang])

  // `now` is fixed once per batch so every page's fecha_hoy + footer share one timestamp.
  const pageFor = (emp: Employee, now: Date): DocumentPageData => {
    const vars = buildVariables(emp, hrById[emp.id], company, lang, now)
    const footer = `${emp.firstName} ${emp.lastName} · ${now.toLocaleDateString(lang.startsWith('es') ? 'es-DO' : 'en-US')}`
    return {
      title: fillTemplate(template!.title, vars),
      body: fillTemplate(template!.body, vars),
      footer,
      signatureLeft: template!.signatureLeft ? fillTemplate(template!.signatureLeft, vars) : undefined,
      signatureRight: template!.signatureRight ? fillTemplate(template!.signatureRight, vars) : undefined,
    }
  }

  const generate = async () => {
    if (!template || selectedEmployees.length === 0) return
    setGenerating(true)
    try {
      const { ContractDocument, BulkDocument } = await import('../../lib/ContractDocument')
      const now = new Date()
      const nowIso = now.toISOString()
      const generatedBy = profile?.full_name || user?.email || ''
      const size = pageSize
      const margin = inchesToPoints(marginIn)

      if (selectedEmployees.length === 1) {
        const emp = selectedEmployees[0]
        const blob = await generatePdfBlob(<ContractDocument data={pageFor(emp, now)} company={company} size={size} margin={margin} />)
        downloadBlob(blob, `${safeFilePart(template.name)}_${safeFilePart(`${emp.firstName}_${emp.lastName}`)}.pdf`)
      } else {
        const pages = selectedEmployees.map((emp) => pageFor(emp, now))
        const blob = await generatePdfBlob(<BulkDocument pages={pages} company={company} size={size} margin={margin} />)
        downloadBlob(blob, `${safeFilePart(template.name)}_${selectedEmployees.length}.pdf`)
      }

      const records: GeneratedDocumentRecord[] = selectedEmployees.map((emp) => ({
        id: generateId(),
        templateId: template.id,
        templateName: template.name,
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        country: emp.country ?? selectedCountry,
        generatedAt: nowIso,
        generatedBy,
      }))
      addRecords(records)
      void logAuditEvent({
        action: 'document_generated',
        category: 'documentos',
        resource_type: 'document',
        resource_id: template.id,
        details: { template: template.name, employeeCount: selectedEmployees.length },
      })

      toast({
        variant: 'success',
        title: selectedEmployees.length === 1
          ? t('documentos.generate.generatedOne')
          : t('documentos.generate.generatedBulk', { count: selectedEmployees.length }),
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({ variant: 'destructive', title: t('documentos.generate.error'), description: msg })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('documentos.generate.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('documentos.generate.subtitle')}</p>
        </div>
        <CountryScopeSelect />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left: template + employees */}
        <div className="space-y-6 lg:col-span-3">
          {/* Step 1 — template */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('documentos.generate.step1')}</CardTitle>
            </CardHeader>
            <CardContent>
              {templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('documentos.generate.noTemplates')}{' '}
                  <Link to="/documentos/templates" className="text-emerald-600 hover:underline">{t('documentos.nav.templates')}</Link>
                </p>
              ) : (
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('documentos.generate.chooseTemplate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Step 2 — employees */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{t('documentos.generate.step2')}</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {t('documentos.generate.selectedCount', { count: selected.size })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('documentos.generate.search')}
                    className="pl-8"
                  />
                </div>
                <Select value={dept} onValueChange={setDept}>
                  <SelectTrigger className="sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_DEPTS}>{t('documentos.generate.allDepartments')}</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 text-xs">
                <Button size="sm" variant="outline" onClick={selectAllVisible} disabled={visibleEmployees.length === 0}>
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  {t('documentos.generate.selectAll')}
                </Button>
                <Button size="sm" variant="outline" onClick={clearAll} disabled={selected.size === 0}>
                  {t('documentos.generate.clearAll')}
                </Button>
              </div>

              <div className="max-h-[360px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {visibleEmployees.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('documentos.generate.noEmployees')}</p>
                ) : (
                  visibleEmployees.map((e) => (
                    <label key={e.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-secondary/50">
                      <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{e.firstName} {e.lastName}</p>
                        <p className="truncate text-xs text-muted-foreground">{e.jobTitle} · {e.department}</p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: preview + generate */}
        <div className="space-y-4 lg:col-span-2">
          <Card className="lg:sticky lg:top-4">
            <CardHeader>
              <CardTitle className="text-base">{t('documentos.generate.preview')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!template ? (
                <p className="text-sm text-muted-foreground">{t('documentos.generate.previewPickTemplate')}</p>
              ) : !preview ? (
                <p className="text-sm text-muted-foreground">{t('documentos.generate.previewPickEmployee')}</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">{t('documentos.generate.previewFor', { name: preview.name })}</p>
                  <div className="max-h-[320px] overflow-y-auto rounded-lg border border-border bg-secondary/30 p-3">
                    <p className="text-center text-xs font-bold uppercase tracking-wide text-foreground">{preview.title}</p>
                    <p className="mt-2 whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/90">{preview.body}</p>
                  </div>
                </>
              )}

              {/* Manual cédula editor for the previewed employee (fills the doc + saves to DB). */}
              {canGenerate && selectedEmployees.length > 0 && (
                <div className="space-y-1.5 rounded-lg border border-border bg-secondary/30 p-3">
                  <label className="text-xs font-medium text-foreground">
                    {t('documentos.generate.cedulaLabel', { name: `${selectedEmployees[0].firstName} ${selectedEmployees[0].lastName}` })}
                  </label>
                  <Input
                    key={selectedEmployees[0].id}
                    defaultValue={hrById[selectedEmployees[0].id]?.nationalId ?? ''}
                    placeholder="000-0000000-0"
                    onBlur={(e) => saveCedula(selectedEmployees[0], e.target.value)}
                  />
                  <p className="text-[10px] text-muted-foreground">{t('documentos.generate.cedulaHint')}</p>
                </div>
              )}

              {/* Page size + margin (applied to the generated PDF) */}
              <div className="space-y-3 rounded-lg border border-border bg-secondary/30 p-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">{t('documentos.generate.pageSize')}</label>
                  <Select value={pageSize} onValueChange={(v) => setPageSize(v as DocumentPageSize)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LETTER">{t('documentos.generate.pageLetter')}</SelectItem>
                      <SelectItem value="LEGAL">{t('documentos.generate.pageLegal')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">{t('documentos.generate.margin')}</label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number" min={0.25} max={2} step={0.05}
                      value={marginIn}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value)
                        setMarginIn(Number.isFinite(n) ? Math.min(2, Math.max(0.25, n)) : 0.8)
                      }}
                      className="w-24"
                    />
                    <span className="text-xs text-muted-foreground">{t('documentos.generate.inches')}</span>
                  </div>
                </div>
              </div>

              {!hasHrData && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    {t('documentos.generate.noHrData')}{' '}
                    <Link to="/nomina/employees" className="font-medium underline">{t('documentos.generate.goToEmployees')}</Link>
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                disabled={!canGenerate || !template || selected.size === 0 || generating}
                onClick={generate}
              >
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                {selected.size > 1
                  ? t('documentos.generate.generateBulk', { count: selected.size })
                  : t('documentos.generate.generateOne')}
              </Button>
              {!canGenerate && (
                <p className={cn('flex items-center gap-1 text-[11px] text-muted-foreground')}>
                  <FileText className="h-3 w-3" />
                  {t('documentos.generate.noPermission')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
