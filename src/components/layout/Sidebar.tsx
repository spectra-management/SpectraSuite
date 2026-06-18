import { NavLink, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Users,
  DollarSign,
  History,
  Plug,
  Settings,
  ArrowLeft,
  Banknote,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/store/settingsStore'

const navItems = [
  { key: 'dashboard', to: '/nomina/dashboard', icon: LayoutDashboard, end: false },
  { key: 'employees', to: '/nomina/employees', icon: Users, end: false },
  { key: 'payroll', to: '/nomina/payroll', icon: DollarSign, end: false },
  { key: 'history', to: '/nomina/history', icon: History, end: false },
  { key: 'connectors', to: '/nomina/connectors', icon: Plug, end: false },
  { key: 'settings', to: '/nomina/settings', icon: Settings, end: false },
]

export function Sidebar() {
  const { t } = useTranslation()
  const company = useSettingsStore((s) => s.company)

  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-white">
      {/* Back to Spectra Suite */}
      <div className="border-b border-border px-4 py-3">
        <Link to="/suite" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-emerald-700">
          <ArrowLeft className="h-3.5 w-3.5" /> {t('suite.back')}
        </Link>
      </div>

      {/* Module brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-grad text-emerald-50">
          <Banknote className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className="text-sm font-bold uppercase tracking-wide text-gray-900">{t('suite.modules.nomina')}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ key, to, icon: Icon, end }) => (
          <NavLink
            key={key}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-secondary hover:text-gray-900',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-600" />
                )}
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-emerald-600' : 'text-gray-400')} />
                {t(`nav.${key}`)}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer: company + version */}
      <div className="flex items-center gap-2 border-t border-border p-4">
        {company.logoBase64 ? (
          <img src={company.logoBase64} alt="logo" className="h-7 w-7 rounded-md object-contain" />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-[11px] font-bold text-white">
            {company.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-gray-700">{company.name}</p>
          <p className="text-[10px] text-gray-400">Spectra Suite</p>
        </div>
      </div>
    </aside>
  )
}
