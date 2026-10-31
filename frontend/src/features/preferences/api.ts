import { useSyncExternalStore } from 'react'
import { networkRequest } from '@/shared/api/http'
import {
  languagePreferences,
  setLanguagePreferences,
  type LearningLanguage,
} from '@/features/languages/api'
import {
  pronunciationPreferences,
  setPronunciationPreferences,
  type PronunciationPreferences,
} from '@/features/languages/pronunciationPreferences'
import type { SortOption } from '@/features/words/model/wordDomain'

export type Preferences = {
  language: LearningLanguage
  translation_language: 'ru' | 'en'
  page_size: 50 | 100 | 200
  sort: SortOption
  theme: 'dark' | 'light' | 'system'
  swipes: boolean
  pronunciation: boolean
  translations: boolean
  summary: boolean
  badges: boolean
  colours: boolean
  animations: boolean
  pronunciation_modes: PronunciationPreferences
}
export const DEFAULT_PREFERENCES: Preferences = {
  language: 'en',
  translation_language: 'ru',
  page_size: 50,
  sort: 'level-asc',
  theme: 'dark',
  swipes: true,
  pronunciation: true,
  translations: true,
  summary: true,
  badges: true,
  colours: true,
  animations: true,
  pronunciation_modes: {},
}
const key = 'lexora-owner-preferences-v1'
type Snapshot = { values: Preferences; status: 'saved' | 'saving' | 'error'; error: string }
function readCache() {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '{}')
  } catch {
    return {}
  }
}
const cached = readCache()
const localLanguages = languagePreferences()
let snapshot: Snapshot = {
  values: {
    ...DEFAULT_PREFERENCES,
    language: localLanguages.language,
    translation_language: localLanguages.translationLanguage,
    pronunciation_modes: pronunciationPreferences(),
    ...cached.values,
  },
  status: 'saved',
  error: '',
}
let pending: Partial<Preferences> = cached.pending ?? {}
let saving = false
let editVersion = 0
const listeners = new Set<() => void>()
export const preferencesSnapshot = () => snapshot
export function subscribePreferences(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function usePreferences() {
  return useSyncExternalStore(subscribePreferences, preferencesSnapshot).values
}

function publish(values: Preferences, status: Snapshot['status'], error = '') {
  snapshot = { values, status, error }
  try {
    localStorage.setItem(key, JSON.stringify({ values, pending }))
  } catch {
    /* Keep this tab usable. */
  }
  const current = languagePreferences()
  if (
    current.language !== values.language ||
    current.translationLanguage !== values.translation_language
  ) {
    setLanguagePreferences({
      language: values.language,
      translationLanguage: values.translation_language,
    })
  }
  setPronunciationPreferences(values.pronunciation_modes)
  listeners.forEach((listener) => listener())
}

export async function loadPreferences() {
  if (saving || !navigator.onLine) return
  if (Object.keys(pending).length) {
    await flushPreferences()
    return
  }
  const version = editVersion
  try {
    const values = await networkRequest<Preferences>('/api/preferences', {
      signal: AbortSignal.timeout(10_000),
    })
    // A setting may have changed while this read was in flight.
    if (version === editVersion && !saving && !Object.keys(pending).length) publish(values, 'saved')
  } catch {
    /* Cached preferences remain available without a connection. */
  }
}

export function updatePreferences(patch: Partial<Preferences>) {
  editVersion += 1
  const modes = patch.pronunciation_modes
    ? { ...snapshot.values.pronunciation_modes, ...patch.pronunciation_modes }
    : snapshot.values.pronunciation_modes
  pending = {
    ...pending,
    ...patch,
    ...(patch.pronunciation_modes
      ? { pronunciation_modes: { ...pending.pronunciation_modes, ...patch.pronunciation_modes } }
      : {}),
  }
  publish({ ...snapshot.values, ...patch, pronunciation_modes: modes }, 'saving')
  void flushPreferences()
}

export async function flushPreferences() {
  if (saving || !Object.keys(pending).length) return
  saving = true
  try {
    while (Object.keys(pending).length) {
      const patch = pending
      pending = {}
      try {
        const values = await networkRequest<Preferences>('/api/preferences', {
          method: 'PATCH',
          body: JSON.stringify(patch),
          signal: AbortSignal.timeout(10_000),
        })
        publish(
          {
            ...values,
            ...pending,
            pronunciation_modes: { ...values.pronunciation_modes, ...pending.pronunciation_modes },
          },
          Object.keys(pending).length ? 'saving' : 'saved',
        )
      } catch (error) {
        pending = {
          ...patch,
          ...pending,
          ...(patch.pronunciation_modes || pending.pronunciation_modes
            ? {
                pronunciation_modes: {
                  ...patch.pronunciation_modes,
                  ...pending.pronunciation_modes,
                },
              }
            : {}),
        }
        publish(
          snapshot.values,
          'error',
          error instanceof Error ? error.message : 'Could not sync settings.',
        )
        break
      }
    }
  } finally {
    saving = false
  }
}
