import {useState} from 'react'
import type {SortMode} from './TopicSortMenu'

function load<T>(key: string, def: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? def } catch { return def }
}
function save(key: string, val: unknown) { localStorage.setItem(key, JSON.stringify(val)) }

export const SIDEBAR_PREF_KEYS = {
  posCollapsed:    'sidebar_pos_collapsed',
  topicsCollapsed: 'sidebar_topics_collapsed',
  posSort:         'sidebar_pos_sort',
  topicsSort:      'sidebar_topics_sort',
  pinned:          'sidebar_pinned',
} as const

export function useTopicSidebarPrefs() {
  const [posCollapsed,    setPosCollapsedRaw]    = useState(() => load(SIDEBAR_PREF_KEYS.posCollapsed, false))
  const [topicsCollapsed, setTopicsCollapsedRaw] = useState(() => load(SIDEBAR_PREF_KEYS.topicsCollapsed, false))
  const [posSort,         setPosSortRaw]         = useState<SortMode>(() => load(SIDEBAR_PREF_KEYS.posSort, 'weakest'))
  const [topicsSort,      setTopicsSortRaw]      = useState<SortMode>(() => load(SIDEBAR_PREF_KEYS.topicsSort, 'weakest'))
  const [pinnedIds,       setPinnedIdsRaw]       = useState<number[]>(() => load(SIDEBAR_PREF_KEYS.pinned, []))

  function setPosCollapsed(v: boolean)    { setPosCollapsedRaw(v);    save(SIDEBAR_PREF_KEYS.posCollapsed, v) }
  function setTopicsCollapsed(v: boolean) { setTopicsCollapsedRaw(v); save(SIDEBAR_PREF_KEYS.topicsCollapsed, v) }
  function setPosSort(v: SortMode)        { setPosSortRaw(v);         save(SIDEBAR_PREF_KEYS.posSort, v) }
  function setTopicsSort(v: SortMode)     { setTopicsSortRaw(v);      save(SIDEBAR_PREF_KEYS.topicsSort, v) }

  function togglePin(id: number) {
    const next = pinnedIds.includes(id)
      ? pinnedIds.filter((x) => x !== id)
      : [id, ...pinnedIds].slice(0, 5)
    setPinnedIdsRaw(next)
    save(SIDEBAR_PREF_KEYS.pinned, next)
  }

  return {
    posCollapsed, setPosCollapsed,
    topicsCollapsed, setTopicsCollapsed,
    posSort, setPosSort,
    topicsSort, setTopicsSort,
    pinnedIds, togglePin,
  }
}
