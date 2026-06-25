import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, Pencil, Trash2, Lock, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/shared/components/ui/dialog'
import { supabase } from '@/shared/lib/supabase'
import { logAuditEvent } from '@/shared/lib/audit'
import { toast } from '@/shared/hooks/useToast'
import type { RoleRow, RolePermissionRow, ModuleId, ModulePerm } from '@/shared/types/supabase'

const MODULES: ModuleId[] = ['nomina', 'rrhh', 'facturacion', 'documentos', 'gastos', 'it']
type Draft = Record<ModuleId, ModulePerm>
const emptyDraft = (): Draft => {
  const d = {} as Draft
  for (const m of MODULES) d[m] = { can_view: false, can_edit: false, can_approve: false, can_admin: false }
  return d
}

const PERM_ICON: Record<keyof ModulePerm, string> = {
  can_view: '👁️', can_edit: '✏️', can_approve: '✓', can_admin: '🔐',
}

export function RolesPanel() {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [perms, setPerms] = useState<RolePermissionRow[]>([])
  const [usageByRole, setUsageByRole] = useState<Record<string, number>>({})
  const [editing, setEditing] = useState<RoleRow | 'new' | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: r }, { data: p }, { data: ur }] = await Promise.all([
      supabase.from('roles').select('*').order('is_system', { ascending: false }).order('name'),
      supabase.from('role_permissions').select('*'),
      supabase.from('user_roles').select('role_id'),
    ])
    setRoles(r ?? [])
    setPerms(p ?? [])
    const usage: Record<string, number> = {}
    for (const row of (ur ?? []) as { role_id: string }[]) usage[row.role_id] = (usage[row.role_id] ?? 0) + 1
    setUsageByRole(usage)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const systemRoles = roles.filter((r) => r.is_system)
  const customRoles = roles.filter((r) => !r.is_system)
  const permsFor = (roleId: string) => perms.filter((p) => p.role_id === roleId)

  const PermPreview = ({ roleId }: { roleId: string }) => {
    const rp = permsFor(roleId)
    if (rp.length === 0) return <span className="text-xs text-muted-foreground">—</span>
    return (
      <div className="flex flex-wrap gap-2">
        {rp.map((p) => {
          const flags = (['can_view', 'can_edit', 'can_approve', 'can_admin'] as (keyof ModulePerm)[])
            .filter((k) => p[k]).map((k) => PERM_ICON[k]).join(' ')
          if (!flags) return null
          return (
            <span key={p.module} className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              {t(`suite.modules.${p.module}`)} {flags}
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          {t('roles.title')}
        </CardTitle>
        <CardDescription>{t('roles.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* System roles (read-only) */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('roles.systemRoles')}</h3>
              <div className="divide-y divide-border rounded-xl border border-border">
                {systemRoles.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Lock className="h-3 w-3 text-muted-foreground" />
                        <p className="text-sm font-semibold text-foreground">{r.name}</p>
                        <span className="text-xs text-muted-foreground">· {usageByRole[r.id] ?? 0} {t('roles.users')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.description}</p>
                      <div className="mt-1.5">
                        {r.name === 'Super Admin'
                          ? <span className="text-xs text-emerald-700 dark:text-emerald-400">{t('roles.allAccess')}</span>
                          : <PermPreview roleId={r.id} />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Custom roles (editable) */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('roles.customRoles')}</h3>
                <Button size="sm" onClick={() => setEditing('new')} className="gap-1.5">
                  <Plus className="h-4 w-4" /> {t('roles.createNew')}
                </Button>
              </div>
              {customRoles.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">{t('roles.noCustom')}</p>
              ) : (
                <div className="divide-y divide-border rounded-xl border border-border">
                  {customRoles.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-foreground">{r.name}</p>
                          <span className="text-xs text-muted-foreground">· {usageByRole[r.id] ?? 0} {t('roles.users')}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{r.description}</p>
                        <div className="mt-1.5"><PermPreview roleId={r.id} /></div>
                      </div>
                      <Button variant="outline" size="icon" onClick={() => setEditing(r)} aria-label={t('common.edit')}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </CardContent>

      {editing && (
        <RoleDialog
          role={editing === 'new' ? null : editing}
          existingPerms={editing === 'new' ? [] : permsFor(editing.id)}
          usageCount={editing === 'new' ? 0 : (usageByRole[editing.id] ?? 0)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void load() }}
        />
      )}
    </Card>
  )
}

function RoleDialog({
  role, existingPerms, usageCount, onClose, onSaved,
}: {
  role: RoleRow | null
  existingPerms: RolePermissionRow[]
  usageCount: number
  onClose: () => void
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const isEdit = !!role
  const [name, setName] = useState(role?.name ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => {
    const d = emptyDraft()
    for (const p of existingPerms) {
      if (d[p.module]) d[p.module] = { can_view: p.can_view, can_edit: p.can_edit, can_approve: p.can_approve, can_admin: p.can_admin }
    }
    return d
  })

  // Permission ladder: view → edit → approve; admin independent.
  const setPerm = (m: ModuleId, key: keyof ModulePerm, value: boolean) => {
    setDraft((d) => {
      const cur = { ...d[m], [key]: value }
      if (key === 'can_view' && !value) { cur.can_edit = false; cur.can_approve = false }
      if (key === 'can_edit') { if (value) cur.can_view = true; else cur.can_approve = false }
      if (key === 'can_approve' && value) { cur.can_view = true; cur.can_edit = true }
      return { ...d, [m]: cur }
    })
  }

  const rowsToInsert = (roleId: string) => MODULES
    .filter((m) => draft[m].can_view || draft[m].can_edit || draft[m].can_approve || draft[m].can_admin)
    .map((m) => ({ role_id: roleId, module: m, ...draft[m] }))

  const handleSave = async () => {
    if (!name.trim()) { toast({ variant: 'destructive', title: t('roles.nameRequired') }); return }
    setSaving(true)
    try {
      if (isEdit && role) {
        const oldPerms = existingPerms.map((p) => ({ module: p.module, can_view: p.can_view, can_edit: p.can_edit, can_approve: p.can_approve, can_admin: p.can_admin }))
        const { error: uErr } = await supabase.from('roles')
          .update({ name: name.trim(), description: description.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', role.id)
        if (uErr) throw uErr
        await supabase.from('role_permissions').delete().eq('role_id', role.id)
        const rows = rowsToInsert(role.id)
        if (rows.length) { const { error } = await supabase.from('role_permissions').insert(rows); if (error) throw error }
        void logAuditEvent({ action: 'role_updated', category: 'user_management', resource_type: 'role', resource_id: role.id, details: { roleName: name.trim(), oldPermissions: oldPerms, newPermissions: rows } })
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        const { data: created, error: cErr } = await supabase.from('roles')
          .insert({ name: name.trim(), description: description.trim() || null, is_system: false, is_editable: true, created_by: session?.user.id ?? null })
          .select('id').single()
        if (cErr) throw cErr
        const rows = rowsToInsert(created.id)
        if (rows.length) { const { error } = await supabase.from('role_permissions').insert(rows); if (error) throw error }
        void logAuditEvent({ action: 'role_created', category: 'user_management', resource_type: 'role', resource_id: created.id, details: { roleName: name.trim(), permissions: rows } })
        toast({ variant: 'success', title: t('roles.created') })
      }
      if (isEdit) toast({ variant: 'success', title: t('common.success') })
      onSaved()
    } catch (e) {
      toast({ variant: 'destructive', title: t('common.error'), description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!role) return
    if (!window.confirm(t('roles.deleteConfirm', { count: usageCount }))) return
    setSaving(true)
    try {
      const { error } = await supabase.from('roles').delete().eq('id', role.id)
      if (error) throw error
      void logAuditEvent({ action: 'role_deleted', category: 'user_management', resource_type: 'role', details: { roleName: role.name, affectedUsers: usageCount } })
      toast({ variant: 'success', title: t('roles.deleted') })
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
          <DialogTitle>{isEdit ? t('roles.editRole') : t('roles.createRole')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {isEdit && usageCount > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {t('roles.editWarning', { count: usageCount })}
            </p>
          )}
          <div className="space-y-1.5">
            <Label>{t('roles.name')}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('roles.namePlaceholder')} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('roles.description')}</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t('roles.permissions')}</Label>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[24rem] text-sm">
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
                      <td className="px-3 py-2 font-medium text-foreground">{t(`suite.modules.${m}`)}</td>
                      <td className="px-2 py-2 text-center">
                        <Checkbox checked={draft[m].can_view} onCheckedChange={(v) => setPerm(m, 'can_view', !!v)} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Checkbox checked={draft[m].can_edit} disabled={!draft[m].can_view} onCheckedChange={(v) => setPerm(m, 'can_edit', !!v)} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Checkbox checked={draft[m].can_approve} disabled={!draft[m].can_edit} onCheckedChange={(v) => setPerm(m, 'can_approve', !!v)} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Checkbox checked={draft[m].can_admin} onCheckedChange={(v) => setPerm(m, 'can_admin', !!v)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {isEdit ? (
            <Button variant="outline" onClick={() => void handleDelete()} disabled={saving} className="gap-1.5 text-red-600 hover:text-red-700 dark:text-red-400">
              <Trash2 className="h-4 w-4" /> {t('common.delete')}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? t('roles.update') : t('roles.create')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
