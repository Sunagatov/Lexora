import {useState} from 'react'

type WordMixView = 'list' | 'swipe'
const storageKey = 'lexora-word-mix-view'

// Keep the existing device-local choice when moving its control into My Lexora.
export function useWordMixView() {
  const [view, setView] = useState<WordMixView>(() => {
    try { return localStorage.getItem(storageKey) === 'swipe' ? 'swipe' : 'list' }
    catch { return 'list' }
  })

  function selectView(next: WordMixView) {
    setView(next)
    try { localStorage.setItem(storageKey, next) } catch { /* In-memory selection still works. */ }
  }

  return [view, selectView] as const
}
