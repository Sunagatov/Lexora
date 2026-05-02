import {useState} from 'react'

const KEY = 'sidebar_collapsed'

export function useSidebarCollapsedPref() {
  const [collapsed, setCollapsedRaw] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === 'true'
    } catch {
      return false
    }
  })

  function setCollapsed(v: boolean) {
    setCollapsedRaw(v)
    try { localStorage.setItem(KEY, String(v)) } catch { /* ignore */ }
  }

  return {collapsed, setCollapsed}
}
