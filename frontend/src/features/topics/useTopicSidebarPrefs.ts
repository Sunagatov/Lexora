import {useState} from 'react'
import type {SortMode} from './TopicSortMenu'

const SORT_MODES: readonly SortMode[] = ['default', 'weakest', 'strongest', 'largest', 'az', 'za'] as const

function loadUnknown(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

function save(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val))
}

export function sanitizeBoolean(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback
}

export function sanitizeSortMode(raw: unknown, fallback: SortMode): SortMode {
  return typeof raw === 'string' && SORT_MODES.includes(raw as SortMode)
    ? (raw as SortMode)
    : fallback
}

export function sanitizeIdList(raw: unknown, limit = 5): number[] {
  if (!Array.isArray(raw)) return []

  return Array.from(
    new Set(
      raw
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  ).slice(0, limit)
}

export const SIDEBAR_PREF_KEYS = {
  posCollapsed:    'sidebar_pos_collapsed',
  topicsCollapsed: 'sidebar_topics_collapsed',
  posSort:         'sidebar_pos_sort',
  topicsSort:      'sidebar_topics_sort',
  pinned:          'sidebar_pinned',
  recent:          'sidebar_recent_topics',
} as const

export function useTopicSidebarPrefs() {
  const [posCollapsed, setPosCollapsedRaw] = useState(() =>
    sanitizeBoolean(loadUnknown(SIDEBAR_PREF_KEYS.posCollapsed), false),
  )

  const [topicsCollapsed, setTopicsCollapsedRaw] = useState(() =>
    sanitizeBoolean(loadUnknown(SIDEBAR_PREF_KEYS.topicsCollapsed), false),
  )

  const [posSort, setPosSortRaw] = useState<SortMode>(() =>
    sanitizeSortMode(loadUnknown(SIDEBAR_PREF_KEYS.posSort), 'weakest'),
  )

  const [topicsSort, setTopicsSortRaw] = useState<SortMode>(() =>
    sanitizeSortMode(loadUnknown(SIDEBAR_PREF_KEYS.topicsSort), 'weakest'),
  )

  const [pinnedIds, setPinnedIdsRaw] = useState<number[]>(() =>
    sanitizeIdList(loadUnknown(SIDEBAR_PREF_KEYS.pinned)),
  )

  const [recentIds, setRecentIdsRaw] = useState<number[]>(() =>
    sanitizeIdList(loadUnknown(SIDEBAR_PREF_KEYS.recent)),
  )

  function setPosCollapsed(v: boolean) {
    setPosCollapsedRaw(v)
    save(SIDEBAR_PREF_KEYS.posCollapsed, v)
  }

  function setTopicsCollapsed(v: boolean) {
    setTopicsCollapsedRaw(v)
    save(SIDEBAR_PREF_KEYS.topicsCollapsed, v)
  }

  function setPosSort(v: SortMode) {
    setPosSortRaw(v)
    save(SIDEBAR_PREF_KEYS.posSort, v)
  }

  function setTopicsSort(v: SortMode) {
    setTopicsSortRaw(v)
    save(SIDEBAR_PREF_KEYS.topicsSort, v)
  }

  function togglePin(id: number) {
    const next = pinnedIds.includes(id)
      ? pinnedIds.filter((x) => x !== id)
      : [id, ...pinnedIds].slice(0, 5)

    setPinnedIdsRaw(next)
    save(SIDEBAR_PREF_KEYS.pinned, next)
  }

  function addRecentId(id: number) {
    const next = [id, ...recentIds.filter((x) => x !== id)].slice(0, 5)
    setRecentIdsRaw(next)
    save(SIDEBAR_PREF_KEYS.recent, next)
  }

  return {
    posCollapsed,
    setPosCollapsed,
    topicsCollapsed,
    setTopicsCollapsed,
    posSort,
    setPosSort,
    topicsSort,
    setTopicsSort,
    pinnedIds,
    togglePin,
    recentIds,
    addRecentId,
  }
}
