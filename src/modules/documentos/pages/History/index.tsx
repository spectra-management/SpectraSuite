import { useTranslation } from 'react-i18next'
import { History as HistoryIcon } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { useDocumentsStore } from '../../store/documentsStore'

export default function History() {
  const { t, i18n } = useTranslation()
  const records = useDocumentsStore((s) => s.records)
  const locale = i18n.language.startsWith('es') ? 'es-DO' : 'en-US'

  const fmt = (iso: string) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('documentos.history.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('documentos.history.subtitle')}</p>
      </div>

      {records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <HistoryIcon className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t('documentos.history.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">{t('documentos.history.employee')}</th>
                    <th className="px-4 py-3 font-medium">{t('documentos.history.template')}</th>
                    <th className="px-4 py-3 font-medium">{t('documentos.history.date')}</th>
                    <th className="px-4 py-3 font-medium">{t('documentos.history.by')}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                      <td className="px-4 py-2.5 font-medium text-foreground">{r.employeeName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.templateName}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{fmt(r.generatedAt)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.generatedBy || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
