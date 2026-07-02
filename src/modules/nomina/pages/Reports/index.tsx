import { useMemo, useState } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, FileText, Table as TableIcon, Loader2, FileBarChart2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { usePayrollStore } from '@/shared/store/payrollStore'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useEmployeeHrStore } from '@/shared/store/employeeHrStore'
import { toast } from '@/shared/hooks/useToast'
import { roundHalfUp, safeNum } from '@/modules/nomina/lib/payroll/calculations'
import { generatePdfBlob, downloadBlob } from '@/modules/nomina/lib/pdf/generatePdf'
import { downloadCSV } from '@/modules/nomina/lib/pdf/generateCsv'
import { currencyForCountry } from '@/shared/lib/utils/currency'
import type { TssReportRow } from '@/modules/nomina/lib/pdf/tssReportPdf'
import type { PayrollPeriod } from '@/shared/types'

/** DR runs only — TSS is a Dominican Republic report. Legacy runs without a country are DR. */
function isDRRun(p: PayrollPeriod): boolean {
  const c = (p.country ?? '').toLowerCase().trim()
  return c === '' || c.includes('dominican') || c === 'do' || c === 'rd'
}

/**
 * "Salario cotizable" of one payroll entry: every earning EXCEPT the overtime and
 * holiday premiums (worked OT/holiday hours are paid at 100% inside regular pay,
 * which IS cotizable — only the surcharges are excluded). Matches the TSS base
 * used by the payroll calculation.
 */
function cotizableOf(gross: number, otPay: number, holidayPay: number): number {
  return roundHalfUp(safeNum(gross) - safeNum(otPay) - safeNum(holidayPay))
}

const MONTHS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

export default function Reports() {
  const { t, i18n } = useTranslation()
  const history = usePayrollStore((s) => s.history)
  const company = useSettingsStore((s) => s.company)
  const hrById = useEmployeeHrStore((s) => s.byId)
  const lang = (i18n.language?.startsWith('es') ? 'es' : 'en') as 'en' | 'es'
  const locale = lang === 'es' ? 'es-DO' : 'en-US'

  const [month, setMonth] = useState(() => new Date().getMonth())
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [generating, setGenerating] = useState(false)

  // Years present in the payroll history (plus the current one), newest first.
  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()])
    for (const p of history) {
      const y = Number(p.startDate?.slice(0, 4))
      if (Number.isFinite(y)) set.add(y)
    }
    return [...set].sort((a, b) => b - a)
  }, [history])

  // Finalized DR runs inside the selected month.
  const runs = useMemo(
    () =>
      history.filter((p) => {
        if (p.status === 'draft' || !isDRRun(p)) return false
        const d = new Date(p.startDate + 'T00:00:00')
        return d.getFullYear() === year && d.getMonth() === month
      }),
    [history, month, year],
  )

  // One row per employee, aggregated over the month's runs (e.g. both quincenas).
  const rows: TssReportRow[] = useMemo(() => {
    const map = new Map<string, TssReportRow>()
    for (const p of runs) {
      for (const e of p.entries) {
        const c = e.calculation
        const cur = map.get(e.employee.id) ?? {
          employeeId: e.employee.id,
          cedula: hrById[e.employee.id]?.nationalId ?? '',
          fullName: `${e.employee.firstName} ${e.employee.lastName}`.trim(),
          cotizable: 0,
          sfs: 0,
          afp: 0,
        }
        map.set(e.employee.id, {
          ...cur,
          cotizable: roundHalfUp(cur.cotizable + cotizableOf(c.grossPay, c.otPay, c.holidayPay)),
          sfs: roundHalfUp(cur.sfs + safeNum(c.sfsAmount)),
          afp: roundHalfUp(cur.afp + safeNum(c.afpAmount)),
        })
      }
    }
    return [...map.values()].sort((a, b) => a.fullName.localeCompare(b.fullName))
  }, [runs, hrById])

  const totals = useMemo(
    () => ({
      cotizable: roundHalfUp(rows.reduce((s, r) => s + r.cotizable, 0)),
      sfs: roundHalfUp(rows.reduce((s, r) => s + r.sfs, 0)),
      afp: roundHalfUp(rows.reduce((s, r) => s + r.afp, 0)),
    }),
    [rows],
  )

  const currencySymbol = currencyForCountry('Dominican Republic').symbol
  const fmt = (n: number) =>
    `${currencySymbol} ${roundHalfUp(n, 2).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const periodLabel = new Date(year, month, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  const fileStamp = `${year}-${String(month + 1).padStart(2, '0')}`

  const handlePdf = async () => {
    setGenerating(true)
    try {
      const { TssReportDocument } = await import('@/modules/nomina/lib/pdf/tssReportPdf')
      const element = React.createElement(TssReportDocument, {
        periodLabel,
        rows,
        company,
        lang,
        currencySymbol,
      })
      const blob = await generatePdfBlob(element)
      downloadBlob(blob, `TSS_Report_${fileStamp}.pdf`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      toast({ variant: 'destructive', title: t('errors.pdfFailed'), description: msg })
    } finally {
      setGenerating(false)
    }
  }

  const handleCsv = () => {
    const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const header = [
      t('reports.tss.cols.cedula'),
      t('reports.tss.cols.name'),
      t('reports.tss.cols.cotizable'),
      t('reports.tss.cols.sfs'),
      t('reports.tss.cols.afp'),
      t('reports.tss.cols.totalTss'),
    ].join(',')
    const lines = rows.map((r) =>
      [
        esc(r.cedula || ''),
        esc(r.fullName),
        r.cotizable.toFixed(2),
        r.sfs.toFixed(2),
        r.afp.toFixed(2),
        roundHalfUp(r.sfs + r.afp).toFixed(2),
      ].join(','),
    )
    const totalLine = [
      '',
      t('reports.tss.totals'),
      totals.cotizable.toFixed(2),
      totals.sfs.toFixed(2),
      totals.afp.toFixed(2),
      roundHalfUp(totals.sfs + totals.afp).toFixed(2),
    ].join(',')
    downloadCSV([header, ...lines, totalLine].join('\n'), `TSS_Report_${fileStamp}.csv`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('reports.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('reports.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              {t('reports.tss.title')}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {new Date(2000, m, 1).toLocaleDateString(locale, { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="h-9 w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handlePdf} disabled={generating || rows.length === 0} className="gap-1.5">
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={handleCsv} disabled={rows.length === 0} className="gap-1.5">
                <TableIcon className="h-3.5 w-3.5" />
                CSV
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t('reports.tss.note')}</p>
        </CardHeader>
        <CardContent className={rows.length === 0 ? undefined : 'p-0'}>
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                <FileBarChart2 className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t('reports.tss.empty', { period: periodLabel })}</p>
            </div>
          ) : (
            <>
              <p className="px-6 pt-1 pb-3 text-xs text-muted-foreground">
                {t('reports.tss.runsIncluded', { count: runs.length, period: periodLabel })}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary">
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('reports.tss.cols.cedula')}</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('reports.tss.cols.name')}</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('reports.tss.cols.cotizable')}</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('reports.tss.cols.sfs')}</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('reports.tss.cols.afp')}</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('reports.tss.cols.totalTss')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((r) => (
                      <tr key={r.employeeId} className="hover:bg-secondary transition-colors">
                        <td className="px-6 py-3 font-mono text-muted-foreground">{r.cedula || '—'}</td>
                        <td className="px-6 py-3 font-medium text-foreground">{r.fullName}</td>
                        <td className="px-6 py-3 text-right font-medium text-foreground">{fmt(r.cotizable)}</td>
                        <td className="px-6 py-3 text-right text-muted-foreground">{fmt(r.sfs)}</td>
                        <td className="px-6 py-3 text-right text-muted-foreground">{fmt(r.afp)}</td>
                        <td className="px-6 py-3 text-right font-semibold text-emerald-700">{fmt(roundHalfUp(r.sfs + r.afp))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-input bg-secondary">
                      <td className="px-6 py-3 font-bold text-foreground" colSpan={2}>
                        {t('reports.tss.totals')} · {t('reports.tss.employeeCount', { count: rows.length })}
                      </td>
                      <td className="px-6 py-3 text-right font-bold text-foreground">{fmt(totals.cotizable)}</td>
                      <td className="px-6 py-3 text-right font-bold text-foreground">{fmt(totals.sfs)}</td>
                      <td className="px-6 py-3 text-right font-bold text-foreground">{fmt(totals.afp)}</td>
                      <td className="px-6 py-3 text-right font-bold text-emerald-700">{fmt(roundHalfUp(totals.sfs + totals.afp))}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
