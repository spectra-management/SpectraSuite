import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { logAuditEvent } from '@/lib/audit'
import { toast } from '@/hooks/useToast'

const MIN = 5
const MAX = 1440
const DEFAULT = 480
const clamp = (m: number) => Math.min(MAX, Math.max(MIN, Math.round(m)))

export function SecuritySettingsPanel() {
  const { t } = useTranslation()
  const { setSessionTimeoutMinutes } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rowId, setRowId] = useState<string | null>(null)
  const [saved, setSaved] = useState(DEFAULT)
  const [value, setValue] = useState(DEFAULT)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('company_settings')
      .select('id, session_timeout_minutes')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      setRowId(data.id)
      const v = data.session_timeout_minutes ?? DEFAULT
      setSaved(v); setValue(v)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const handleSave = async () => {
    const next = clamp(value)
    setSaving(true)
    try {
      const payload = { session_timeout_minutes: next, updated_at: new Date().toISOString() }
      const { error } = rowId
        ? await supabase.from('company_settings').update(payload).eq('id', rowId)
        : await supabase.from('company_settings').insert(payload)
      if (error) throw error
      void logAuditEvent({
        action: 'session_timeout_updated',
        category: 'settings',
        details: { newTimeout: next, oldTimeout: saved },
      })
      setSaved(next)
      setValue(next)
      setSessionTimeoutMinutes(next)   // apply live for the current admin
      toast({ variant: 'success', title: t('settings.security.updated', { minutes: next }) })
    } catch (e) {
      toast({ variant: 'destructive', title: t('common.error'), description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const hours = (saved / 60).toFixed(saved % 60 === 0 ? 0 : 1)
  const tooShort = clamp(value) < 15

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          {t('settings.security.title')}
        </CardTitle>
        <CardDescription>{t('settings.security.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="max-w-md space-y-4">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>{t('settings.security.sessionTimeout')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={MIN}
                  max={MAX}
                  value={value}
                  onChange={(e) => setValue(Number(e.target.value))}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">{t('settings.security.minutes')}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t('settings.security.helper')}</p>
              <p className="text-xs text-muted-foreground">
                {t('settings.security.current', { minutes: saved, hours })}
              </p>
              {tooShort && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> {t('settings.security.shortWarning')}
                </p>
              )}
            </div>
            <Button onClick={() => void handleSave()} disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.saveChanges')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
