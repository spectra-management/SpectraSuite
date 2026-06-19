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
import { useSidebarCollapsed } from '@/hooks/useSidebarCollapsed'
import { SidebarToggle } from './SidebarToggle'

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
  const { collapsed, toggle } = useSidebarCollapsed()

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-card transition-[width] duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Back to Spectra Suite + collapse toggle */}
      <div
        className={cn(
          'border-b border-border',
          collapsed ? 'flex flex-col items-center gap-2 px-2 py-3' : 'flex items-center justify-between px-4 py-3',
        )}
      >
        <Link
          to="/suite"
          title={collapsed ? t('suite.back') : undefined}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-emerald-700 dark:hover:text-emerald-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {!collapsed && t('suite.back')}
        </Link>
        <SidebarToggle collapsed={collapsed} onToggle={toggle} />
      </div>

      {/* Module brand */}
      <div
        className={cn(
          'flex h-16 items-center border-b border-border',
          collapsed ? 'justify-center px-2' : 'gap-2.5 px-5',
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-grad text-emerald-50">
          <Banknote className="h-4 w-4" strokeWidth={1.75} />
        </span>
        {!collapsed && (
          <span className="text-sm font-bold uppercase tracking-wide text-foreground">{t('suite.modules.nomina')}</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ key, to, icon: Icon, end }) => (
          <NavLink
            key={key}
            to={to}
            end={end}
            title={collapsed ? t(`nav.${key}`) : undefined}
            className={({ isActive }) =>
              cn(
                'relative flex items-center rounded-lg text-sm font-medium transition-all duration-150',
                collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2',
                isActive
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-emerald-600" />
                )}
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} />
                {!collapsed && t(`nav.${key}`)}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer: company + version */}
      <div
        className={cn(
          'flex items-center border-t border-border',
          collapsed ? 'justify-center p-3' : 'gap-2 p-4',
        )}
      >
        {company.logoBase64 ? (
          <img src={company.logoBase64} alt="logo" className="h-7 w-7 shrink-0 rounded-md object-contain" title={collapsed ? company.name : undefined} />
        ) : (
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-[11px] font-bold text-white"
            title={collapsed ? company.name : undefined}
          >
            {company.name.charAt(0).toUpperCase()}
          </div>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{company.name}</p>
            <p className="text-[10px] text-muted-foreground">Spectra Suite</p>
          </div>
        )}
      </div>
    </aside>
  )
}
