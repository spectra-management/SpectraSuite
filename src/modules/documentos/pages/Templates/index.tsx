import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Copy, Trash2, FileText, Lock, RotateCcw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Badge } from '@/shared/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/shared/components/ui/dialog'
import { toast } from '@/shared/hooks/useToast'
import { useAuth } from '@/shared/context/AuthContext'
import { logAuditEvent } from '@/shared/lib/audit'
import { useDocumentsStore } from '../../store/documentsStore'
import { TEMPLATE_VARIABLES } from '../../lib/variables'
import type { DocumentTemplate } from '../../lib/types'

interface EditorState {
  id: string | null // null = creating
  name: string
  description: string
  title: string
  body: string
  pageSize: 'A4' | 'LEGAL'
  signatureLeft: string
  signatureRight: string
}

const EMPTY: EditorState = {
  id: null, name: '', description: '', title: '', body: '',
  pageSize: 'A4', signatureLeft: '', signatureRight: '',
}

export default function Templates() {
  const { t } = useTranslation()
  const templates = useDocumentsStore((s) => s.templates)
  const addTemplate = useDocumentsStore((s) => s.addTemplate)
  const updateTemplate = useDocumentsStore((s) => s.updateTemplate)
  const deleteTemplate = useDocumentsStore((s) => s.deleteTemplate)
  const duplicateTemplate = useDocumentsStore((s) => s.duplicateTemplate)
  const applyBuiltInTemplates = useDocumentsStore((s) => s.applyBuiltInTemplates)
  const { hasModuleAccess } = useAuth()
  const canEdit = hasModuleAccess('documentos', 'edit')

  const [editor, setEditor] = useState<EditorState | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const openNew = () => setEditor({ ...EMPTY })
  const openEdit = (tpl: DocumentTemplate) =>
    setEditor({
      id: tpl.id, name: tpl.name, description: tpl.description, title: tpl.title, body: tpl.body,
      pageSize: tpl.pageSize ?? 'A4', signatureLeft: tpl.signatureLeft ?? '', signatureRight: tpl.signatureRight ?? '',
    })

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`
    const el = bodyRef.current
    setEditor((prev) => {
      if (!prev) return prev
      if (!el) return { ...prev, body: prev.body + token }
      const start = el.selectionStart ?? prev.body.length
      const end = el.selectionEnd ?? prev.body.length
      const next = prev.body.slice(0, start) + token + prev.body.slice(end)
      // Restore caret just after the inserted token on next tick.
      requestAnimationFrame(() => {
        el.focus()
        const pos = start + token.length
        el.setSelectionRange(pos, pos)
      })
      return { ...prev, body: next }
    })
  }

  const save = () => {
    if (!editor) return
    // Title is optional (e.g. the bank letter has none); name + body are required.
    if (!editor.name.trim() || !editor.body.trim()) {
      toast({ variant: 'destructive', title: t('documentos.templates.missingFields') })
      return
    }
    const payload = {
      name: editor.name.trim(),
      description: editor.description.trim(),
      title: editor.title.trim(),
      body: editor.body,
      pageSize: editor.pageSize,
      signatureLeft: editor.signatureLeft.trim() || undefined,
      signatureRight: editor.signatureRight.trim() || undefined,
    }
    if (editor.id) {
      updateTemplate(editor.id, payload)
      void logAuditEvent({ action: 'template_updated', category: 'documentos', resource_type: 'template', resource_id: editor.id })
    } else {
      const tpl = addTemplate(payload)
      void logAuditEvent({ action: 'template_created', category: 'documentos', resource_type: 'template', resource_id: tpl.id })
    }
    toast({ variant: 'success', title: t('documentos.templates.saved') })
    setEditor(null)
  }

  const handleDelete = (tpl: DocumentTemplate) => {
    if (!window.confirm(t('documentos.templates.deleteConfirm', { name: tpl.name }))) return
    deleteTemplate(tpl.id)
    void logAuditEvent({ action: 'template_deleted', category: 'documentos', resource_type: 'template', resource_id: tpl.id })
    toast({ variant: 'success', title: t('documentos.templates.deleted') })
  }

  const handleDuplicate = (tpl: DocumentTemplate) => {
    const copy = duplicateTemplate(tpl.id, t('documentos.templates.copySuffix'))
    if (copy) toast({ variant: 'success', title: t('documentos.templates.duplicated') })
  }

  const handleRestore = () => {
    if (!window.confirm(t('documentos.templates.restoreConfirm'))) return
    const { added, updated } = applyBuiltInTemplates()
    toast({ variant: 'success', title: t('documentos.templates.restored', { added, updated }) })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('documentos.templates.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('documentos.templates.subtitle')}</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRestore} title={t('documentos.templates.restoreHint')}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t('documentos.templates.restore')}
            </Button>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              {t('documentos.templates.new')}
            </Button>
          </div>
        )}
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {canEdit ? t('documentos.templates.empty') : t('documentos.templates.emptyNoPermission')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="flex flex-col">
              <CardHeader className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{tpl.name}</CardTitle>
                  {tpl.isSystem && (
                    <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                      <Lock className="h-3 w-3" />
                      {t('documentos.templates.system')}
                    </Badge>
                  )}
                </div>
                <CardDescription>{tpl.description}</CardDescription>
              </CardHeader>
              {canEdit && (
                <CardContent className="flex gap-1.5 pt-0">
                  <Button size="sm" variant="outline" onClick={() => openEdit(tpl)}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    {t('common.edit')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDuplicate(tpl)} title={t('documentos.templates.duplicate')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {!tpl.isSystem && (
                    <Button size="sm" variant="outline" onClick={() => handleDelete(tpl)} title={t('common.delete')}>
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </Button>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editor} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editor?.id ? t('documentos.templates.editTitle') : t('documentos.templates.newTitle')}</DialogTitle>
            <DialogDescription>{t('documentos.templates.editorHint')}</DialogDescription>
          </DialogHeader>

          {editor && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t('documentos.templates.name')}</Label>
                  <Input
                    value={editor.name}
                    onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                    placeholder={t('documentos.templates.namePlaceholder')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t('documentos.templates.docTitle')}</Label>
                  <Input
                    value={editor.title}
                    onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                    placeholder={t('documentos.templates.docTitlePlaceholder')}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t('documentos.templates.description')}</Label>
                <Input
                  value={editor.description}
                  onChange={(e) => setEditor({ ...editor, description: e.target.value })}
                  placeholder={t('documentos.templates.descriptionPlaceholder')}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t('documentos.templates.body')}</Label>
                <Textarea
                  ref={bodyRef}
                  value={editor.body}
                  onChange={(e) => setEditor({ ...editor, body: e.target.value })}
                  placeholder={t('documentos.templates.bodyPlaceholder')}
                  className="min-h-[260px] font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-xs font-medium text-foreground">{t('documentos.templates.insertVariable')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_VARIABLES.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => insertVariable(key)}
                      title={t(`documentos.vars.${key}`)}
                      className="rounded-md border border-input bg-card px-2 py-1 font-mono text-[11px] text-emerald-700 transition-colors hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                    >
                      {`{{${key}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Page size + side-by-side signature captions (optional) */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t('documentos.templates.pageSize')}</Label>
                  <select
                    value={editor.pageSize}
                    onChange={(e) => setEditor({ ...editor, pageSize: e.target.value as 'A4' | 'LEGAL' })}
                    className="flex h-9 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground"
                  >
                    <option value="A4">{t('documentos.templates.pageSizeA4')}</option>
                    <option value="LEGAL">{t('documentos.templates.pageSizeLegal')}</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>{t('documentos.templates.signatures')}</Label>
                <p className="text-[11px] text-muted-foreground">{t('documentos.templates.signaturesHint')}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Textarea
                    value={editor.signatureLeft}
                    onChange={(e) => setEditor({ ...editor, signatureLeft: e.target.value })}
                    placeholder={t('documentos.templates.signatureLeftPlaceholder')}
                    className="min-h-[72px] text-xs"
                  />
                  <Textarea
                    value={editor.signatureRight}
                    onChange={(e) => setEditor({ ...editor, signatureRight: e.target.value })}
                    placeholder={t('documentos.templates.signatureRightPlaceholder')}
                    className="min-h-[72px] text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>{t('common.cancel')}</Button>
            <Button onClick={save}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
