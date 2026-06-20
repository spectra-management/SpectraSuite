import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, UserPlus, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { supabase, authRedirectTo } from '@/lib/supabase'
import { toast } from '@/hooks/useToast'
import type { ProfileRow, ModulePermissionRow, UserRole, ModuleId } from '@/types/supabase'

const MODULES: ModuleId[] = ['nomina', 'rrhh', 'facturacion', 'gastos', 'it']
const ROLES: UserRole[] = ['super_admin', 'module_admin', 'viewer', 'custom']

const ROLE_BADGE: Record<UserRole, string> = {
  super_admin: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  module_admin: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  viewer: 'bg-secondary text-muted-foreground',
  custom: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300',
}

interface PermDraft { can_view: boolean; can_edit: boolean; can_approve: boolean; can_admin: boolean }

export function UsersPanel() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [perms, setPerms] = useState<ModulePermissionRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<ProfileRow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: profiles, error: pErr }, { data: permRows }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('user_module_permissions').select('*'),
    ])
    if (pErr) {
      toast({ variant: 'destructive', title: t('users.loadError') })
    }
    setUsers(profiles ?? [])
    setPerms(permRows ?? [])
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
          perms={perms.filter((p) => p.user_id === editing.id)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load() }}
        />
      )}
    </Card>
  )
}

function EditUserDialog({
  user, perms, onClose, onSaved,
}: {
  user: ProfileRow
  perms: ModulePermissionRow[]
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const [role, setRole] = useState<UserRole>(user.role)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Record<ModuleId, PermDraft>>(() => {
    const base = {} as Record<ModuleId, PermDraft>
    for (const m of MODULES) {
      const existing = perms.find((p) => p.module === m)
      base[m] = {
        can_view: existing?.can_view ?? false,
        can_edit: existing?.can_edit ?? false,
        can_approve: existing?.can_approve ?? false,
        can_admin: existing?.can_admin ?? false,
      }
    }
    return base
  })

  const setPerm = (m: ModuleId, key: keyof PermDraft, value: boolean) =>
    setDraft((d) => ({ ...d, [m]: { ...d[m], [key]: value } }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error: roleErr } = await supabase
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (roleErr) throw roleErr

      // Replace this user's module permission rows. Only persist rows for the
      // 'custom' role; other roles derive access from the role itself.
      await supabase.from('user_module_permissions').delete().eq('user_id', user.id)
      if (role === 'custom') {
        const rows = MODULES
          .filter((m) => draft[m].can_view || draft[m].can_edit || draft[m].can_approve || draft[m].can_admin)
          .map((m) => ({ user_id: user.id, module: m, ...draft[m] }))
        if (rows.length > 0) {
          const { error: insErr } = await supabase.from('user_module_permissions').insert(rows)
          if (insErr) throw insErr
        }
      }
      toast({ variant: 'success', title: t('common.success') })
      onSaved()
    } catch (e) {
      toast({ variant: 'destructive', title: t('common.error'), description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{user.full_name || user.email}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('users.role')}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{t(`users.roles.${r}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {role === 'custom' && (
            <div className="space-y-2">
              <Label>{t('users.modulePermissions')}</Label>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[26rem] text-sm">
                  <thead className="bg-secondary text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('users.module')}</th>
                      <th className="px-2 py-2">{t('users.canView')}</th>
                      <th className="px-2 py-2">{t('users.canEdit')}</th>
                      <th className="px-2 py-2">{t('users.canApprove')}</th>
                      <th className="px-2 py-2">{t('users.canAdmin')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {MODULES.map((m) => (
                      <tr key={m}>
                        <td className="px-3 py-2 font-medium text-muted-foreground">{t(`suite.modules.${m}`)}</td>
                        {(['can_view', 'can_edit', 'can_approve', 'can_admin'] as (keyof PermDraft)[]).map((k) => (
                          <td key={k} className="px-2 py-2 text-center">
                            <Switch
                              checked={draft[m][k]}
                              onCheckedChange={(v) => setPerm(m, k, v)}
                              aria-label={`${m}-${k}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={() => void handleSave()} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('common.saveChanges')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
