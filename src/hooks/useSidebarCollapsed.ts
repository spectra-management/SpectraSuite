import { useState, useCallback } from 'react'

const STORAGE_KEY = 'sidebar_collapsed'

/**
 * Collapsed/expanded state for the module sidebars, persisted to localStorage
 * ('sidebar_collapsed' = boolean). Default is expanded. Shared by the Nómina
 * Sidebar and the placeholder ModuleShell sidebar so the choice sticks across
 * modules.
 */
export function useSidebarCollapsed(): { collapsed: boolean; toggle: () => void } {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  return { collapsed, toggle }
}
