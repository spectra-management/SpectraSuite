import { NavLink, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Users, Network, CalendarDays, Building2, ArrowLeft, X } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { useSettingsStore } from '@/shared/store/settingsStore'
import { useSidebarCollapsed } from '@/shared/hooks/useSidebarCollapsed'
import { SidebarToggle } from '@/shared/components/layout/SidebarToggle'

const navItems: { key: string; to: string; icon: typeof Users }[] = [
  { key: 'directory', to: '/rrhh/directory', icon: Users },
  { key: 'orgChart', to: '/rrhh/org', icon: Network },
  { key: 'timeOff', to: '/rrhh/time-off', icon: CalendarDays },
  { key: 'departments', to: '/rrhh/departments', icon: Building2 },
]

/**
 * RRHH module sidebar. Same structure/behaviour as the Nómina sidebar (collapsible
 * icon rail on desktop, slide-in drawer on mobile) but with RRHH nav + routes, so the
 * two modules look identical.
 */
export function RrhhSidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const { t } = useTranslation()
  const company = useSettingsStore((s) => s.company)
  const { collapsed, toggle } = useSidebarCollapsed()

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-card',
        'fixed inset-y-0 left-0 z-50 w-[280px] transition-transform duration-200 ease-in-out',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        'md:static md:z-auto md:translate-x-0 md:transition-[width]',
        collapsed ? 'md:w-16' : 'md:w-60',
      )}
    >
      {/* Back to Spectra Suite + (mobile close / desktop collapse) */}
      <div className={cn('flex items-center justify-between gap-1 border-b border-border py-3', collapsed ? 'px-4 md:px-2' : 'px-4')}>
        <Link
          to="/suite"
          title={collapsed ? t('suite.back') : undefined}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-emerald-700 dark:hover:text-emerald-400"
        >
          <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
          <span className={cn(collapsed && 'md:hidden')}>{t('suite.back')}</span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
        <span className="hidden md:flex">
          <SidebarToggle collapsed={collapsed} onToggle={toggle} />
        </span>
      </div>

      {/* Module brand */}
      <div className={cn('flex h-16 items-center border-b border-border', collapsed ? 'gap-2.5 px-5 md:justify-center md:gap-0 md:px-2' : 'gap-2.5 px-5')}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ink-grad text-emerald-50">
          <Building2 className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <span className={cn('text-sm font-bold uppercase tracking-wide text-foreground', collapsed && 'md:hidden')}>
          {t('suite.modules.rrhh')}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-auto p-3">
        {navItems.map(({ key, to, icon: Icon }) => (
          <NavLink
            key={key}
            to={to}
            onClick={onClose}
            title={collapsed ? t(`rrhh.nav.${key}`) : undefined}
            className={({ isActive }) =>
              cn(
                'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                collapsed && 'md:justify-center md:gap-0 md:px-0',
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
                <span className={cn(collapsed && 'md:hidden')}>{t(`rrhh.nav.${key}`)}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer: company + suite */}
      <div className={cn('flex items-center border-t border-border', collapsed ? 'gap-2 p-4 md:justify-center md:p-3' : 'gap-2 p-4')}>
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
        <div className={cn('min-w-0', collapsed && 'md:hidden')}>
          <p className="truncate text-xs font-semibold text-foreground">{company.name}</p>
          <p className="text-[10px] text-muted-foreground">Spectra Suite</p>
        </div>
      </div>
    </aside>
  )
}
