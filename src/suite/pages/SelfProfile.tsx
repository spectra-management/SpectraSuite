import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, UserX } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { UserMenu } from '@/shared/components/layout/UserMenu'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { Toaster } from '@/shared/components/ui/toaster'
import { useCurrentEmployee } from '@/shared/hooks/useCurrentEmployee'
import type { CloudEmployee } from '@/shared/connectors/bamboohr-hr'
import { Profile } from '@/modules/rrhh'
import type { RrhhEmployee, RrhhEmployeeStatus } from '@/modules/rrhh/types'

/** Map the DB-backed CloudEmployee onto the RRHH profile's RrhhEmployee shape. */
function toRrhhEmployee(e: CloudEmployee): RrhhEmployee {
  const status: RrhhEmployeeStatus =
    e.status === 'Inactive' ? 'Inactive' : e.status === 'Terminated' ? 'Terminated' : 'Active'
  const location = [e.city, e.state].filter(Boolean).join(', ')
  return {
    id: e.id,
    employeeNumber: e.employeeNumber,
    firstName: e.firstName,
    lastName: e.lastName,
    preferredName: '',
    displayName: [e.firstName, e.lastName].filter(Boolean).join(' ') || e.workEmail,
    jobTitle: e.jobTitle,
    department: e.department,
    division: e.division,
    location,
    hireDate: e.hireDate,
    status,
    supervisor: e.supervisor,
    supervisorId: '',
    workEmail: e.workEmail,
    personalEmail: '',
    mobilePhone: e.mobilePhone,
    workPhone: e.workPhone,
    homePhone: e.homePhone,
    gender: e.gender,
    dateOfBirth: e.dateOfBirth,
    maritalStatus: e.maritalStatus,
    nationality: e.nationality,
    country: e.country,
    city: e.city,
    state: e.state,
    address: e.address,
    address2: '',
    zipcode: e.zipcode,
    ssn: e.nationalId,
    payRate: e.payRate,
    payRateCurrency: e.payRateCurrency,
    payType: e.payType,
    payPer: '',
    paySchedule: '',
    payGroup: '',
    exempt: '',
    photoUrl: '',
  }
}

/**
 * Self-service profile for normal (non-manager) users. Shows the signed-in user their own
 * employee profile — everything except Notes & Documents (handled by Profile's selfMode).
 */
export default function SelfProfile() {
  const { t, i18n } = useTranslation()
  const { employee, ready } = useCurrentEmployee()
  const currentLang = i18n.language.startsWith('es') ? 'es' : 'en'

  useEffect(() => { document.title = `${t('selfProfile.title')} | Spectra Suite` }, [t])

  const rrhhEmployee = useMemo(() => (employee ? toRrhhEmployee(employee) : null), [employee])

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-8">
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

      <main className="px-4 py-6 md:px-8 md:py-8">
        {!ready ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : rrhhEmployee ? (
          <Profile selfMode selfEmployee={rrhhEmployee} />
        ) : (
          <Card className="mx-auto max-w-lg">
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <UserX className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{t('selfProfile.notLinkedTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('selfProfile.notLinkedHint')}</p>
            </CardContent>
          </Card>
        )}
      </main>
      <Toaster />
    </div>
  )
}
