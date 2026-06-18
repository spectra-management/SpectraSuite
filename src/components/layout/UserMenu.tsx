import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { LogOut, Settings as SettingsIcon, UserRound, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/AuthContext'
import { isSupabaseConfigured } from '@/lib/supabase'

const ROLE_LABEL_KEY: Record<string, string> = {
  super_admin: 'users.roles.super_admin',
  module_admin: 'users.roles.module_admin',
  viewer: 'users.roles.viewer',
  custom: 'users.roles.custom',
}

export function UserMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, profile, isSuperAdmin, signOut } = useAuth()

  // Nothing to show if auth is disabled or no one is signed in.
  if (!isSupabaseConfigured || !user) return null

  const name = profile?.full_name || user.user_metadata?.full_name || user.email || ''
  const email = profile?.email || user.email || ''
  const avatarUrl = profile?.avatar_url || (user.user_metadata?.avatar_url as string | undefined)
  const initial = (name || email || 'U').charAt(0).toUpperCase()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-2 text-sm outline-none transition-colors hover:bg-secondary focus:ring-2 focus:ring-emerald-500">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="h-7 w-7 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
            {initial}
          </span>
        )}
        <span className="hidden max-w-[10rem] truncate font-medium text-foreground sm:block">{name}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        {/* Profile header */}
        <div className="flex items-center gap-3 px-3 py-2">
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} className="h-9 w-9 rounded-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
              {initial}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            {profile && (
              <span className="mt-0.5 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                {t(ROLE_LABEL_KEY[profile.role] ?? 'users.roles.viewer')}
              </span>
            )}
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => navigate('/suite')}>
          <UserRound className="h-4 w-4 text-muted-foreground" />
          {t('userMenu.profile')}
        </DropdownMenuItem>

        {isSuperAdmin && (
          <DropdownMenuItem onSelect={() => navigate('/suite/settings')}>
            <SettingsIcon className="h-4 w-4 text-muted-foreground" />
            {t('userMenu.settings')}
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => void signOut()}
          className="text-red-600 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-500/10 dark:focus:text-red-300"
        >
          <LogOut className="h-4 w-4" />
          {t('userMenu.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
