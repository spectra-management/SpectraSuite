import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useEmployeesStore } from '@/shared/store/employeesStore'
import { useDocumentsStore } from '../store/documentsStore'

/**
 * Country scope for the Documentos module. Every page is scoped to the selected country:
 * templates, generation and history all show only that country's items. Auto-selects the
 * first available country so the module always has a scope. The list is the set of countries
 * present among active employees.
 */
export function CountryScopeSelect() {
  const { t } = useTranslation()
  const employees = useEmployeesStore((s) => s.employees)
  const selectedCountry = useDocumentsStore((s) => s.selectedCountry)
  const setSelectedCountry = useDocumentsStore((s) => s.setSelectedCountry)

  const countries = useMemo(
    () => [...new Set(employees.filter((e) => e.status === 'Active').map((e) => e.country).filter(Boolean) as string[])].sort(),
    [employees],
  )

  useEffect(() => {
    if (!selectedCountry && countries.length > 0) setSelectedCountry(countries[0])
  }, [selectedCountry, countries, setSelectedCountry])

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 shrink-0 text-emerald-600" />
      <span className="text-sm text-muted-foreground">{t('documentos.country.label')}</span>
      <Select value={selectedCountry} onValueChange={setSelectedCountry}>
        <SelectTrigger className="w-56"><SelectValue placeholder={t('documentos.country.select')} /></SelectTrigger>
        <SelectContent>
          {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  )
}
