#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"
cd "$ROOT_DIR"

if [[ ! -d frontend || ! -f frontend/package.json ]]; then
  echo "Error: run this from the Lexora repo root, or pass the repo root as the first argument."
  exit 1
fi

backup_dir=".lexora_frontend_bugfix_backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"

backup_file() {
  local f="$1"
  mkdir -p "$backup_dir/$(dirname "$f")"
  cp "$f" "$backup_dir/$f"
}

for f in \
  frontend/package.json \
  frontend/eslint.config.js \
  frontend/vite.config.ts \
  frontend/src/shared/http.ts \
  frontend/src/layout/AppFooter.tsx \
  frontend/src/features/words/useWordPageState.ts \
  frontend/src/features/words/WordPage.tsx \
  frontend/src/features/words/wordForm.ts \
  frontend/src/features/trash/TrashPage.tsx
do
  backup_file "$f"
done

cat > frontend/package.json <<'EOF'
{
  "name": "lexora-frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint src"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.59.20",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.0.0",
    "@types/react": "^19.0.2",
    "@types/react-dom": "^19.0.2",
    "@vitejs/plugin-react": "^4.3.4",
    "@vitest/ui": "^4.1.4",
    "eslint": "^9.0.0",
    "eslint-plugin-react-hooks": "^7.0.1",
    "globals": "^15.11.0",
    "prettier": "^3.8.2",
    "typescript": "^5.6.3",
    "typescript-eslint": "^8.0.0",
    "vite": "^6.0.1",
    "vitest": "^4.1.4"
  }
}
EOF

cat > frontend/eslint.config.js <<'EOF'
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {ignores: ['dist']},
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
    plugins: {'react-hooks': reactHooks},
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
    },
  },
)
EOF

cat > frontend/vite.config.ts <<'EOF'
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
EOF

cat > frontend/src/shared/http.ts <<'EOF'
export {ApiError} from './apiError'

import {ApiError} from './apiError'

function normalizeBaseUrl(raw: string | undefined): string {
  const trimmed = raw?.trim()
  if (trimmed) return trimmed.replace(/\/+$/, '')
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/+$/, '')
  return ''
}

const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const csrfToken = localStorage.getItem('csrf_token')
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken)

  const response = await fetch(`${API_BASE_URL}${path}`, {...init, headers, credentials: 'include'})

  if (response.status === 401) throw new ApiError(401, 'Not authenticated')

  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      // ignore parse errors
    }
    throw new ApiError(response.status, detail)
  }

  if (response.status === 204 || response.status === 205) return undefined as unknown as T

  return response.json() as Promise<T>
}
EOF

cat > frontend/src/layout/AppFooter.tsx <<'EOF'
import {useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {fetchTopics} from '../features/topics/api'
import {fetchWords} from '../features/words/api'
import {queryKeys} from '../shared/queryKeys'
import {routes} from '../shared/routes'

export function AppFooter() {
  const navigate = useNavigate()
  const wordsQuery = useQuery({queryKey: queryKeys.words, queryFn: () => fetchWords()})
  const topicsQuery = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})

  return (
    <footer className="app-footer">
      <button type="button" className="app-footer-brand" onClick={() => navigate(routes.home)}>Lexora</button>
      <div className="app-footer-stats">
        {wordsQuery.data && <span>{wordsQuery.data.length.toLocaleString()} words</span>}
        {topicsQuery.data && <span>{topicsQuery.data.length} topics</span>}
      </div>
      <div className="app-footer-right">
        <span>Personal vocabulary app · {new Date().getFullYear()}</span>
      </div>
    </footer>
  )
}
EOF

cat > frontend/src/features/words/useWordPageState.ts <<'EOF'
import {useState, useMemo, useEffect, useRef} from 'react'
import {useParams, useNavigate, useLocation} from 'react-router-dom'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {fetchWord, fetchWords, updateWord, deleteWord} from './api'
import {fetchTopics} from '../topics/api'
import type {Word, Topic} from '../../shared/types'
import {ApiError} from '../../shared/apiError'
import {queryKeys} from '../../shared/queryKeys'
import {routes} from '../../shared/routes'
import {type EditState, toEditState, buildSavePayload} from './wordForm'

function resolveTopic(word: Word, topics: Topic[], fromTopicSlug: string | undefined): Topic | undefined {
  if (!word.topic_ids.length) return undefined
  if (fromTopicSlug) {
    return topics.find((t) => t.slug === fromTopicSlug) ?? topics.find((t) => t.id === word.topic_ids[0])
  }
  return topics.find((t) => t.id === word.topic_ids[0])
}

export function useWordPageState() {
  const {wordId} = useParams<{wordId: string}>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const editing = location.pathname.endsWith('/edit')
  const fromTopicSlug = (location.state as {fromTopicSlug?: string} | null)?.fromTopicSlug

  const [draft, setDraft] = useState<EditState | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const numericWordId = Number(wordId)

  const wordQuery = useQuery({queryKey: queryKeys.word(numericWordId), queryFn: () => fetchWord(numericWordId)})
  const topicsQuery = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})
  const allWordsQuery = useQuery({queryKey: queryKeys.words, queryFn: () => fetchWords()})

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Word>) => updateWord(numericWordId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.word(numericWordId), updated)
      queryClient.setQueryData<Word[]>(queryKeys.words, (cur = []) => cur.map((w) => w.id === updated.id ? updated : w))
      navigate(routes.word(numericWordId), {replace: true, state: location.state})
      setDraft(null)
      setSaveError(null)
    },
    onError: (err: Error) => {
      const msg = err instanceof ApiError && err.status === 409
        ? 'A word with this term already exists in the selected topic.'
        : err instanceof ApiError && (err.status === 400 || err.status === 422)
          ? 'Invalid data — check the fields and try again.'
          : 'Failed to save. Please try again.'
      setSaveError(msg)
    },
  })

  const capturedTopicSlug = useRef<string | null>(null)
  const deleteMutation = useMutation({
    mutationFn: () => deleteWord(numericWordId),
    onSuccess: () => {
      queryClient.setQueryData<Word[]>(queryKeys.words, (cur = []) => cur.filter((w) => w.id !== numericWordId))
      queryClient.removeQueries({queryKey: queryKeys.word(numericWordId)})
      navigate(capturedTopicSlug.current ? routes.topic(capturedTopicSlug.current) : routes.home, {replace: true})
    },
  })

  const word = wordQuery.data
  const topics = topicsQuery.data ?? []
  const topic = word ? resolveTopic(word, topics, fromTopicSlug) : undefined

  const allWords = allWordsQuery.data ?? []
  const topicWords = useMemo(
    () => word && topic
      ? allWords.filter((w) => w.topic_ids.includes(topic.id)).sort((a, b) => a.term.localeCompare(b.term))
      : [],
    [allWords, word, topic],
  )
  const currentIdx = topicWords.findIndex((w) => w.id === word?.id)
  const prevWord = currentIdx > 0 ? topicWords[currentIdx - 1] : null
  const nextWord = currentIdx >= 0 && currentIdx < topicWords.length - 1 ? topicWords[currentIdx + 1] : null

  useEffect(() => {
    if (editing && word && !draft) setDraft(toEditState(word))
    if (!editing) setDraft(null)
  }, [editing, word?.id])

  function set(field: keyof EditState, value: string | string[]) {
    setDraft((d) => d ? {...d, [field]: value} : d)
  }

  function save() {
    if (!draft || !word) return
    setSaveError(null)
    const termVal = draft.term.trim()
    const transVal = draft.translations.trim()
    const topicIds = draft.topic_ids.map(Number).filter((n) => n > 0)
    if (!termVal) {
      setSaveError('Term cannot be empty.')
      return
    }
    if (!transVal) {
      setSaveError('Translation cannot be empty.')
      return
    }
    if (!topicIds.length) {
      setSaveError('Please select a topic.')
      return
    }
    const isVerb = draft.part_of_speech === 'verb'
    const isNoun = draft.part_of_speech === 'noun'
    saveMutation.mutate(buildSavePayload(draft, isVerb, isNoun))
  }

  function handleDelete() {
    capturedTopicSlug.current = topic?.slug ?? fromTopicSlug ?? null
    setConfirming(false)
    deleteMutation.mutate()
  }

  return {
    wordId: numericWordId,
    editing,
    location,
    word,
    topics,
    topic,
    topicWords,
    currentIdx,
    prevWord,
    nextWord,
    draft,
    set,
    save,
    saveError,
    setSaveError,
    savePending: saveMutation.isPending,
    confirming,
    setConfirming,
    handleDelete,
    fromTopicSlug,
    isLoading: wordQuery.isLoading || topicsQuery.isLoading,
  }
}
EOF

cat > frontend/src/features/words/WordPage.tsx <<'EOF'
import {useNavigate, useLocation} from 'react-router-dom'
import {LEVEL_LABELS, levelClass} from '../../shared/wordDomain'
import {ConfirmModal} from '../../shared/ConfirmModal'
import {routes} from '../../shared/routes'
import {useWordPageState} from './useWordPageState'

export function WordPage() {
  const s = useWordPageState()
  const navigate = useNavigate()
  const location = useLocation()

  if (s.isLoading) return <div className="word-page-loading">Loading…</div>
  if (!s.word) return <div className="word-page-loading">Word not found.</div>

  const {word, topics, topic, draft, set, editing} = s
  const lc = levelClass(word.knowledge_level)
  const isVerb = (draft?.part_of_speech ?? word.part_of_speech) === 'verb'
  const isNoun = (draft?.part_of_speech ?? word.part_of_speech) === 'noun'
  const backRoute = topic?.slug
    ? routes.topic(topic.slug)
    : s.fromTopicSlug
      ? routes.topic(s.fromTopicSlug)
      : routes.home

  return (
    <div className="word-page">

      <div className="word-page-hero-wrap">
        <div className="word-page-topbar">
          <button
            type="button"
            className="word-page-back-btn"
            onClick={() => editing
              ? navigate(routes.word(s.wordId), {replace: true, state: location.state})
              : navigate(backRoute)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12" />
            </svg>
            Back
          </button>
          {!editing && (
            <button type="button" className="word-page-edit-btn" onClick={() => navigate(routes.editWord(s.wordId), {state: location.state})}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>
        <div className={`word-page-hero ${lc}`}>
          <h1 className="word-page-term">{word.term}</h1>
        </div>
      </div>

      <div className="word-page-inner">
        {!editing && (
          <div className="word-page-view">
            <ViewRow label="Translation" value={word.translations} />
            <ViewRow label="Part of speech" value={word.part_of_speech ?? '—'} />
            <ViewRow label="Topics" value={topics.filter((t) => word.topic_ids.includes(t.id)).map((t) => t.name).join(', ') || '—'} />
            <ViewRow label="Knowledge" value={word.knowledge_level ? `${word.knowledge_level} — ${LEVEL_LABELS[word.knowledge_level]}` : '—'} />
            {word.countability && <ViewRow label="Countability" value={word.countability} />}
            {word.example && <ViewRow label="Example" value={word.example} />}
            {word.notes && <ViewRow label="Notes" value={word.notes} />}
            {word.pattern && <ViewRow label="Pattern" value={word.pattern} />}
            {word.past_simple && <ViewRow label="Past simple" value={word.past_simple} />}
            {word.past_participle && <ViewRow label="Past participle" value={word.past_participle} />}
            <ViewRow label="Updated" value={new Date(word.updated_at).toLocaleDateString()} />
            <ViewRow label="Created" value={new Date(word.created_at).toLocaleDateString()} />
          </div>
        )}

        {editing && draft && (
          <div className="word-page-edit-form">
            <FormField label="Term">
              <input className="wp-input" value={draft.term} maxLength={255} onChange={(e) => { set('term', e.target.value); s.setSaveError(null) }} />
            </FormField>
            <FormField label="Translations">
              <input className="wp-input" value={draft.translations} onChange={(e) => { set('translations', e.target.value); s.setSaveError(null) }} />
            </FormField>
            <FormField label="Knowledge level">
              <select className="wp-input" value={draft.knowledge_level} onChange={(e) => set('knowledge_level', e.target.value)}>
                <option value="">— not set —</option>
                <option value="1">1 — Weak</option>
                <option value="2">2 — Basic</option>
                <option value="3">3 — Okay</option>
                <option value="4">4 — Strong</option>
                <option value="5">5 — Parked (rare, learn later)</option>
              </select>
            </FormField>
            <FormField label="Part of speech">
              <select className="wp-input" value={draft.part_of_speech} onChange={(e) => set('part_of_speech', e.target.value)}>
                <option value="">— not set —</option>
                <option value="noun">Noun</option>
                <option value="verb">Verb</option>
                <option value="adjective">Adjective</option>
                <option value="adverb">Adverb</option>
                <option value="phrase">Phrase</option>
                <option value="preposition">Preposition</option>
                <option value="other">Other</option>
              </select>
            </FormField>
            <FormField label="Primary topic">
              <select
                className="wp-input"
                value={draft.topic_ids[0] ?? ''}
                onChange={(e) => set('topic_ids', e.target.value ? [e.target.value, ...draft.topic_ids.slice(1)] : draft.topic_ids.slice(1))}
              >
                <option value="">— select topic —</option>
                {topics.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
              </select>
            </FormField>
            {isNoun && (
              <FormField label="Countability">
                <select className="wp-input" value={draft.countability} onChange={(e) => set('countability', e.target.value)}>
                  <option value="">— not set —</option>
                  <option value="Countable">Countable</option>
                  <option value="Uncountable">Uncountable</option>
                  <option value="Both">Both</option>
                </select>
              </FormField>
            )}
            {isVerb && (
              <>
                <FormField label="Past simple">
                  <input className="wp-input" value={draft.past_simple} onChange={(e) => set('past_simple', e.target.value)} />
                </FormField>
                <FormField label="Past participle">
                  <input className="wp-input" value={draft.past_participle} onChange={(e) => set('past_participle', e.target.value)} />
                </FormField>
              </>
            )}
            <FormField label="Example">
              <textarea className="wp-input wp-textarea" rows={3} value={draft.example} onChange={(e) => set('example', e.target.value)} />
            </FormField>
            <FormField label="Notes">
              <textarea className="wp-input wp-textarea" rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
            </FormField>
            <FormField label="Pattern">
              <input className="wp-input" value={draft.pattern} onChange={(e) => set('pattern', e.target.value)} />
            </FormField>
          </div>
        )}
      </div>

      {editing && (
        <div className="word-page-edit-actions">
          {s.saveError && <div className="wp-save-error">{s.saveError}</div>}
          <div className="word-page-edit-actions-row">
            <button type="button" className="wp-btn-delete" onClick={() => s.setConfirming(true)}>Delete</button>
            <div className="word-page-edit-actions-right">
              <button type="button" className="wp-btn-cancel" onClick={() => { navigate(routes.word(s.wordId), {replace: true, state: location.state}); s.setSaveError(null) }}>Cancel</button>
              <button type="button" className="wp-btn-save" disabled={s.savePending} onClick={s.save}>
                {s.savePending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!editing && (
        <div className="word-page-footer">
          <button type="button" className="word-page-nav-btn" disabled={!s.prevWord} onClick={() => s.prevWord && navigate(routes.word(s.prevWord.id), {state: location.state})}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,2 4,7 9,12" /></svg>
            Prev
          </button>
          <span className="word-page-nav-pos">{s.currentIdx >= 0 ? `${s.currentIdx + 1} / ${s.topicWords.length}` : ''}</span>
          <button type="button" className="word-page-nav-btn word-page-nav-btn-next" disabled={!s.nextWord} onClick={() => s.nextWord && navigate(routes.word(s.nextWord.id), {state: location.state})}>
            Next
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="5,2 10,7 5,12" /></svg>
          </button>
        </div>
      )}

      {s.confirming && (
        <ConfirmModal
          title="Move to Trash?"
          message={`"${word.term}" will be moved to Trash and permanently deleted after 30 days.`}
          confirmLabel="Move to Trash"
          danger
          onConfirm={s.handleDelete}
          onCancel={() => s.setConfirming(false)}
        />
      )}
    </div>
  )
}

function ViewRow({label, value}: {label: string; value: string}) {
  return (
    <div className="word-page-view-row">
      <span className="word-page-view-label">{label}</span>
      <span className="word-page-view-value">{value}</span>
    </div>
  )
}

function FormField({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div className="wp-field">
      <label className="wp-label">{label}</label>
      {children}
    </div>
  )
}
EOF

cat > frontend/src/features/words/wordForm.ts <<'EOF'
import type {Word} from '../../shared/types'
import {levelToStr, strToLevel} from '../../shared/wordDomain'
import {toStr, toNullStr, toNullStrIf} from '../../shared/utils'

export type EditState = {
  term: string
  translations: string
  knowledge_level: string
  part_of_speech: string
  topic_ids: string[]
  countability: string
  past_simple: string
  past_participle: string
  example: string
  notes: string
  pattern: string
}

export function toEditState(word: Word): EditState {
  return {
    term: word.term,
    translations: word.translations,
    knowledge_level: levelToStr(word.knowledge_level),
    part_of_speech: toStr(word.part_of_speech),
    topic_ids: word.topic_ids.map(String),
    countability: toStr(word.countability),
    past_simple: toStr(word.past_simple),
    past_participle: toStr(word.past_participle),
    example: toStr(word.example),
    notes: toStr(word.notes),
    pattern: toStr(word.pattern),
  }
}

export function buildSavePayload(draft: EditState, isVerb: boolean, isNoun: boolean): Partial<Word> {
  const topicIds = Array.from(new Set(draft.topic_ids.map(Number).filter((n) => n > 0)))

  return {
    term: draft.term.trim(),
    translations: draft.translations.trim(),
    knowledge_level: strToLevel(draft.knowledge_level),
    part_of_speech: toNullStr(draft.part_of_speech),
    topic_ids: topicIds,
    countability: toNullStrIf(isNoun, draft.countability),
    past_simple: toNullStrIf(isVerb, draft.past_simple),
    past_participle: toNullStrIf(isVerb, draft.past_participle),
    example: toNullStr(draft.example),
    notes: toNullStr(draft.notes),
    pattern: toNullStr(draft.pattern),
  }
}
EOF

cat > frontend/src/features/trash/TrashPage.tsx <<'EOF'
import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {fetchTrashWords, restoreWord} from '../words/api'
import {fetchTrashTopics, restoreTopic} from '../topics/api'
import {purgeTrash} from './api'
import {request} from '../../shared/http'
import type {Word, Topic} from '../../shared/types'
import {ConfirmModal} from '../../shared/ConfirmModal'
import {queryKeys} from '../../shared/queryKeys'
import {routes} from '../../shared/routes'

export function TrashPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [restoreTopicId, setRestoreTopicId] = useState<number | null>(null)

  const configQuery = useQuery({
    queryKey: queryKeys.publicConfig,
    queryFn: () => request<{trash_retention_days: number}>('/api/config/public'),
    staleTime: Infinity,
  })
  const settings = configQuery.data

  const wordsQuery = useQuery({queryKey: queryKeys.trashWords, queryFn: fetchTrashWords})
  const topicsQuery = useQuery({queryKey: queryKeys.trashTopics, queryFn: fetchTrashTopics})

  const restoreWordMutation = useMutation({
    mutationFn: restoreWord,
    onSuccess: (restored) => {
      queryClient.setQueryData<Word[]>(queryKeys.trashWords, (cur = []) => cur.filter((w) => w.id !== restored.id))
      queryClient.invalidateQueries({queryKey: queryKeys.words})
      queryClient.invalidateQueries({queryKey: queryKeys.trashWords})
      queryClient.invalidateQueries({queryKey: queryKeys.topics})
    },
    onError: (err: Error) => {
      alert(err.message)
    },
  })

  const restoreTopicMutation = useMutation({
    mutationFn: ({id, restoreWords}: {id: number; restoreWords: boolean}) => restoreTopic(id, restoreWords),
    onSuccess: (restored) => {
      queryClient.setQueryData<Topic[]>(queryKeys.trashTopics, (cur = []) => cur.filter((t) => t.id !== restored.id))
      queryClient.invalidateQueries({queryKey: queryKeys.topics})
      queryClient.invalidateQueries({queryKey: queryKeys.words})
      queryClient.invalidateQueries({queryKey: queryKeys.trashTopics})
      queryClient.invalidateQueries({queryKey: queryKeys.trashWords})
      setRestoreTopicId(null)
    },
  })

  const purgeMutation = useMutation({
    mutationFn: purgeTrash,
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.trashWords})
      queryClient.invalidateQueries({queryKey: queryKeys.trashTopics})
      setConfirmPurge(false)
    },
  })

  const words = wordsQuery.data ?? []
  const topics = topicsQuery.data ?? []
  const pendingRestoreTopic = topics.find((t) => t.id === restoreTopicId)

  function daysLeft(deletedAt: string) {
    const retention = settings?.trash_retention_days ?? 30
    return Math.max(0, retention - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000))
  }

  return (
    <div className="trash-page">
      <div className="trash-inner">
        <div className="trash-topbar">
          <button type="button" className="word-page-back-btn" onClick={() => navigate(routes.smartReview)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12" />
            </svg>
            Back
          </button>
          {(words.length > 0 || topics.length > 0) && (
            <button type="button" className="trash-purge-btn" onClick={() => setConfirmPurge(true)}>
              Empty Trash
            </button>
          )}
        </div>

        <h1 className="trash-title">Trash</h1>
        <p className="trash-subtitle">Items are permanently deleted after {settings?.trash_retention_days ?? 30} days.</p>

        {topics.length > 0 && (
          <section className="trash-section">
            <div className="trash-section-label">Topics ({topics.length})</div>
            {topics.map((topic) => (
              <div key={topic.id} className="trash-item">
                <div className="trash-item-info">
                  <span className="trash-item-name">{topic.name}</span>
                  <span className="trash-item-days">{daysLeft(topic.deleted_at)} days left</span>
                </div>
                <button type="button" className="trash-restore-btn" onClick={() => setRestoreTopicId(topic.id)} disabled={restoreTopicMutation.isPending}>
                  Restore
                </button>
              </div>
            ))}
          </section>
        )}

        {words.length > 0 && (
          <section className="trash-section">
            <div className="trash-section-label">Words ({words.length})</div>
            {words.map((word) => (
              <div key={word.id} className="trash-item">
                <div className="trash-item-info">
                  <span className="trash-item-name">{word.term}</span>
                  <span className="trash-item-meta">{word.translations}</span>
                  <span className="trash-item-days">{daysLeft(word.deleted_at)} days left</span>
                </div>
                <button type="button" className="trash-restore-btn" onClick={() => restoreWordMutation.mutate(word.id)} disabled={restoreWordMutation.isPending}>
                  Restore
                </button>
              </div>
            ))}
          </section>
        )}

        {words.length === 0 && topics.length === 0 && <div className="trash-empty">Trash is empty.</div>}
      </div>

      {confirmPurge && (
        <ConfirmModal
          title="Empty Trash?"
          message="This will permanently delete everything in Trash right now. This cannot be undone."
          confirmLabel="Empty Trash"
          danger
          onConfirm={() => purgeMutation.mutate()}
          onCancel={() => setConfirmPurge(false)}
        />
      )}

      {restoreTopicId !== null && pendingRestoreTopic && (
        <ConfirmModal
          title={`Restore "${pendingRestoreTopic.name}"?`}
          message="Do you also want to restore all words that were deleted with this topic?"
          confirmLabel="Restore topic + words"
          cancelLabel="Restore topic only"
          onConfirm={() => restoreTopicMutation.mutate({id: restoreTopicId, restoreWords: true})}
          onCancel={() => restoreTopicMutation.mutate({id: restoreTopicId, restoreWords: false})}
          onClose={() => setRestoreTopicId(null)}
        />
      )}
    </div>
  )
}
EOF

echo "Lexora frontend bugfixes applied."
echo "Backup created in: $backup_dir"
echo
echo "Next:"
echo "  cd frontend"
echo "  npm install"
echo "  npm run lint"
echo "  npm run test"
echo "  npm run build"
