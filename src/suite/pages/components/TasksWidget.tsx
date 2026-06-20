import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Check, Trash2, Loader2, ListTodo } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { useAuth } from '@/shared/context/AuthContext'
import {
  fetchGoogleTasks, addGoogleTask, completeGoogleTask, deleteGoogleTask,
  GoogleAuthError, type GoogleTask,
} from '@/shared/lib/google'

const LOCAL_TODOS_KEY = 'spectra_local_todos'

interface LocalTodo { id: string; title: string; done: boolean }

function loadLocal(): LocalTodo[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_TODOS_KEY) ?? '[]') } catch { return [] }
}
function saveLocal(todos: LocalTodo[]) {
  localStorage.setItem(LOCAL_TODOS_KEY, JSON.stringify(todos))
}

export function TasksWidget() {
  const { t } = useTranslation()
  const { googleProviderToken, reconnectGoogle } = useAuth()
  const [useGoogle, setUseGoogle] = useState<boolean>(!!googleProviderToken)
  const [loading, setLoading] = useState<boolean>(!!googleProviderToken)
  const [tasks, setTasks] = useState<GoogleTask[]>([])
  const [local, setLocal] = useState<LocalTodo[]>(loadLocal)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)

  const token = googleProviderToken

  const loadTasks = useCallback(async () => {
    if (!token) { setUseGoogle(false); setLoading(false); return }
    setLoading(true)
    try {
      const items = await fetchGoogleTasks(token)
      setTasks(items)
      setUseGoogle(true)
    } catch (e) {
      // Token missing/expired or API not enabled → fall back to local todos.
      if (e instanceof GoogleAuthError) console.warn('[tasks] Google auth failed; using local fallback')
      else console.warn('[tasks] Google Tasks unavailable; using local fallback', e)
      setUseGoogle(false)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void loadTasks() }, [loadTasks])

  const handleAdd = async () => {
    const title = input.trim()
    if (!title) return
    setInput('')
    if (useGoogle && token) {
      setBusy(true)
      try { await addGoogleTask(token, title); await loadTasks() }
      catch { setUseGoogle(false) }
      finally { setBusy(false) }
    } else {
      const next = [{ id: `${Date.now()}`, title, done: false }, ...local]
      setLocal(next); saveLocal(next)
    }
  }

  const handleComplete = async (id: string) => {
    if (useGoogle && token) {
      setBusy(true)
      try { await completeGoogleTask(token, id); await loadTasks() }
      catch { setUseGoogle(false) }
      finally { setBusy(false) }
    } else {
      const next = local.map((td) => (td.id === id ? { ...td, done: !td.done } : td))
      setLocal(next); saveLocal(next)
    }
  }

  const handleDelete = async (id: string) => {
    if (useGoogle && token) {
      setBusy(true)
      try { await deleteGoogleTask(token, id); await loadTasks() }
      catch { setUseGoogle(false) }
      finally { setBusy(false) }
    } else {
      const next = local.filter((td) => td.id !== id)
      setLocal(next); saveLocal(next)
    }
  }

  const items = useGoogle
    ? tasks.map((tk) => ({ id: tk.id, title: tk.title || '(untitled)', done: tk.status === 'completed' }))
    : local

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListTodo className="h-4 w-4 text-emerald-600" />
          {t('suiteHome.tasks.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }}
            placeholder={t('suiteHome.tasks.placeholder')}
          />
          <Button size="icon" onClick={() => void handleAdd()} disabled={busy} aria-label={t('suiteHome.tasks.add')}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('suiteHome.tasks.empty')}</p>
        ) : (
          <ul className="flex-1 space-y-1 overflow-auto">
            {items.map((it) => (
              <li key={it.id} className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary">
                <button
                  onClick={() => void handleComplete(it.id)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${it.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-input'}`}
                  aria-label="toggle"
                >
                  {it.done && <Check className="h-3 w-3" />}
                </button>
                <span className={`flex-1 text-sm ${it.done ? 'text-muted-foreground line-through' : 'text-muted-foreground'}`}>{it.title}</span>
                <button
                  onClick={() => void handleDelete(it.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="delete"
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {!useGoogle && !loading && (
          <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
            <p className="text-[11px] text-muted-foreground">{t('suiteHome.tasks.localFallback')}</p>
            <button
              onClick={() => void reconnectGoogle()}
              className="shrink-0 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
            >
              {t('suiteHome.google.reconnect')}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
