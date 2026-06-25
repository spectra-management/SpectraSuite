import { useEffect, useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, UserPlus, Pencil, Plus, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { Badge } from '@/shared/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/shared/components/ui/dialog'
import { supabase, authRedirectTo } from '@/shared/lib/supabase'
import { logAuditEvent } from '@/shared/lib/audit'
import { toast } from '@/shared/hooks/useToast'
import type { ProfileRow, UserRole, ModuleId, RoleRow, RolePermissionRow, ModulePerm } from '@/shared/types/supabase'

const MODULES: ModuleId[] = ['nomina', 'rrhh', 'facturacion', 'documentos', 'gastos', 'it']

const ROLE_BADGE: Record<UserRole, string> = {
  super_admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  module_admin: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  viewer: 'bg-secondary text-muted-foreground',
  custom: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
}

export function UsersPanel() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<ProfileRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: profiles, error: pErr } = await supabase
      .from('profiles').select('*').order('created_at', { ascending: true })
    if (pErr) {
      toast({ variant: 'destructive', title: t('users.loadError') })
    }
    setUsers(profiles ?? [])
    setLoading(false)
  }, [t])

  useEffect(() => { void load() }, [load])

  const toggleActive = async (u: ProfileRow) => {
    const next = !u.is_active
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: next } : x)))
    const { error } = await supabase.from('profiles').update({ is_active: next }).eq('id', u.id)
    if (error) {
      toast({ variant: 'destructive', title: t('common.error') })
      void load()
    } else {
      void logAuditEvent({
        action: next ? 'user_activated' : 'user_deactivated',
        category: 'user_management',
        resource_type: 'user',
        resource_id: u.id,
        details: { email: u.email },
      })
    }
  }

  const handleInvite = async () => {
    const email = inviteEmail.trim()
    if (!email) return
    setInviting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ email, redirectTo: authRedirectTo('/suite') }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Invite failed')
      void logAuditEvent({
        action: 'user_invited',
        category: 'user_management',
        resource_type: 'user',
        resource_id: json.userId ?? undefined,
        details: { email },
      })
      toast({ variant: 'success', title: t('users.inviteSent') })
      setInviteEmail('')
    } catch (e) {
      toast({ variant: 'destructive', title: t('users.inviteError'), description: (e as Error).message })
    } finally {
      setInviting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('users.title')}</CardTitle>
        <CardDescription>{t('users.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label>{t('users.inviteEmail')}</Label>
            <Input
              type="email"
              value={inviteEmail}
              placeholder="name@company.com"
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </div>
          <Button onClick={() => void handleInvite()} disabled={inviting} className="gap-1.5">
            {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {t('users.sendInvite')}
          </Button>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : users.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('users.empty')}</p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                    {(u.full_name || u.email).charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{u.full_name || u.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Badge className={ROLE_BADGE[u.role]}>{t(`users.roles.${u.role}`)}</Badge>
                <div className="flex items-center gap-1.5">
                  <Switch checked={u.is_active} onCheckedChange={() => void toggleActive(u)} aria-label="active" />
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {u.is_active ? t('users.active') : t('users.inactive')}
                  </span>
                </div>
                <Button variant="outline" size="icon" onClick={() => setEditing(u)} aria-label={t('users.editPermissions')}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {editing && (
        <EditUserDialog
          user={editing}
          onSaved={() => { setEditing(null); void load() }}
        />
      )}
    </Card>
  )
}

const PERM_LABELS: { key: keyof ModulePerm; label: string }[] = [
  { key: 'can_view', label: 'view' },
  { key: 'can_edit', label: 'edit' },
  { key: 'can_approve', label: 'approve' },
  { key: 'can_admin', label: 'admin' },
]

function EditUserDialog({
  user, onSaved,
}: {
  user: ProfileRow
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [rolePerms, setRolePerms] = useState<RolePermissionRow[]>([])
  const [assigned, setAssigned] = useState<Set<string>>(new Set())

  useEffect(() => {
    let active = true
    void (async () => {
      const [{ data: r }, { data: rp }, { data: ur }] = await Promise.all([
        supabase.from('roles').select('*').order('is_system', { ascending: false }).order('name'),
        supabase.from('role_permissions').select('*'),
        supabase.from('user_roles').select('role_id').eq('user_id', user.id),
      ])
      if (!active) return
      setRoles(r ?? [])
      setRolePerms(rp ?? [])
      setAssigned(new Set((ur ?? []).map((x: { role_id: string }) => x.role_id)))
      setLoading(false)
    })()
    return () => { active = false }
  }, [user.id])

  const superAdminRole = roles.find((r) => r.name === 'Super Admin')
  const hasSuperAdmin = superAdminRole ? assigned.has(superAdminRole.id) : false
  const assignedRoles = roles.filter((r) => assigned.has(r.id))
  const availableRoles = roles.filter((r) => !assigned.has(r.id))

  // Aggregate permissions across the assigned roles (preview).
  const aggregate = useMemo(() => {
    const agg = {} as Record<ModuleId, ModulePerm>
    for (const m of MODULES) agg[m] = { can_view: false, can_edit: false, can_approve: false, can_admin: false }
    if (hasSuperAdmin) return agg
    for (const p of rolePerms) {
      if (!assigned.has(p.role_id) || !agg[p.module]) continue
      agg[p.module] = {
        can_view: agg[p.module].can_view || p.can_view,
        can_edit: agg[p.module].can_edit || p.can_edit,
        can_approve: agg[p.module].can_approve || p.can_approve,
        can_admin: agg[p.module].can_admin || p.can_admin,
      }
    }
    return agg
  }, [assigned, rolePerms, hasSuperAdmin])

  const assignRole = async (role: RoleRow) => {
    setBusy(true)
    const { data: { session } } = await supabase.auth.getSession()
    const { error } = await supabase.from('user_roles').insert({ user_id: user.id, role_id: role.id, assigned_by: session?.user.id ?? null })
    setBusy(false)
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); return }
    setAssigned((prev) => new Set(prev).add(role.id))
    void logAuditEvent({ action: 'role_assigned', category: 'user_management', resource_type: 'user', resource_id: user.id, details: { roleName: role.name, email: user.email } })
  }

  const removeRole = async (role: RoleRow) => {
    if (!window.confirm(t('users.removeRoleConfirm', { role: role.name, name: user.full_name || user.email }))) return
    setBusy(true)
    const { error } = await supabase.from('user_roles').delete().eq('user_id', user.id).eq('role_id', role.id)
    setBusy(false)
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); return }
    setAssigned((prev) => { const n = new Set(prev); n.delete(role.id); return n })
    void logAuditEvent({ action: 'role_removed', category: 'user_management', resource_type: 'user', resource_id: user.id, details: { roleName: role.name, email: user.email } })
  }

  const grantedModules = MODULES.filter((m) => aggregate[m].can_view || aggregate[m].can_admin)

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onSaved() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{user.full_name || user.email}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-5">
            {/* Assigned roles */}
            <div className="space-y-2">
              <Label>{t('users.assignedRoles')}</Label>
              {assignedRoles.length === 0 ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  ⚠️ {t('users.noRolesWarning')}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {assignedRoles.map((r) => (
                    <span key={r.id} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                      {r.name}
                      <button type="button" onClick={() => void removeRole(r)} disabled={busy} aria-label={t('common.delete')} className="hover:text-red-600">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Available roles */}
            <div className="space-y-2">
              <Label>{t('users.availableRoles')}</Label>
              {hasSuperAdmin && (
                <p className="text-xs text-muted-foreground">{t('users.superAdminAll')}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {availableRoles.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => void assignRole(r)}
                    disabled={busy || hasSuperAdmin}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" /> {r.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Aggregate preview */}
            <div className="space-y-2 rounded-xl border border-border bg-secondary/50 p-3">
              <p className="text-xs font-semibold text-foreground">{t('users.effectiveAccess')}</p>
              {hasSuperAdmin ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-400">{t('users.superAdminAll')}</p>
              ) : grantedModules.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('users.noAccess')}</p>
              ) : (
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {grantedModules.map((m) => {
                    const actions = PERM_LABELS.filter(({ key }) => aggregate[m][key]).map(({ label }) => t(`users.canShort.${label}`))
                    return <li key={m}>✓ {t(`suite.modules.${m}`)}: {actions.join(', ')}</li>
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={onSaved}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
