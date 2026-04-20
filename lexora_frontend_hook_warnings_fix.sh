#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"
FRONTEND_DIR="$ROOT_DIR/frontend"

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "frontend directory not found: $FRONTEND_DIR" >&2
  exit 1
fi

timestamp="$(date +%Y%m%d_%H%M%S)"
backup_dir="$ROOT_DIR/.lexora_frontend_hook_warnings_fix_backup_${timestamp}"
mkdir -p "$backup_dir"

backup_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local rel="${file#$ROOT_DIR/}"
    mkdir -p "$backup_dir/$(dirname "$rel")"
    cp "$file" "$backup_dir/$rel"
  fi
}

write_file() {
  local file="$1"
  backup_file "$file"
  cat > "$file"
}

USE_QUICK_ADD="$FRONTEND_DIR/src/features/words/useQuickAdd.ts"
USE_WORD_PAGE_STATE="$FRONTEND_DIR/src/features/words/useWordPageState.ts"

write_file "$USE_QUICK_ADD" <<'EOF'
import {useEffect, useMemo, useRef, useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {createTopic, fetchTopics} from '../topics/api'
import {quickAddWord} from './api'
import {ApiError} from '../../shared/apiError'
import type {Topic} from '../../shared/types'
import {queryKeys} from '../../shared/queryKeys'
import {translateTerm, suggestTopic, ensureInbox} from './quickAddService'

const INBOX_TOPIC_NAME = 'Inbox'

export function useQuickAdd(_onClose: () => void) {
  const queryClient = useQueryClient()
  const termRef     = useRef<HTMLInputElement>(null)

  const [term,        setTerm]        = useState('')
  const [translation, setTranslation] = useState('')
  const [topicId,     setTopicId]     = useState<number | null>(null)
  const [newTopic,    setNewTopic]    = useState('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [suggesting,  setSuggesting]  = useState(false)
  const [aiSuggested, setAiSuggested] = useState(false)
  const [feedback,    setFeedback]    = useState<{ok: boolean; msg: string} | null>(null)

  const topicsQuery = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})
  const topics: Topic[] = useMemo(() => topicsQuery.data ?? [], [topicsQuery.data])

  useEffect(() => {
    if (topicId !== null || topics.length === 0) return
    const inbox = topics.find((t) => t.name === INBOX_TOPIC_NAME)
    if (inbox) setTopicId(inbox.id)
  }, [topics, topicId])

  useEffect(() => {
    const timeoutId = setTimeout(() => termRef.current?.focus(), 80)
    return () => clearTimeout(timeoutId)
  }, [])

  const addWordMutation = useMutation({
    mutationFn: (resolvedTopicId: number) => quickAddWord(term.trim(), translation.trim(), [resolvedTopicId]),
    onSuccess: () => {
      queryClient.invalidateQueries({queryKey: queryKeys.words})
      setFeedback({ok: true, msg: `"${term.trim()}" saved!`})
      setTerm('')
      setTranslation('')
      setAiSuggested(false)
      setTimeout(() => { setFeedback(null); termRef.current?.focus() }, 1800)
    },
    onError: (err: Error) => {
      const msg = err instanceof ApiError && err.status === 409
        ? `"${term.trim()}" already exists in this topic`
        : 'Failed to save. Try again.'
      setFeedback({ok: false, msg})
    },
  })

  const createTopicMutation = useMutation({
    mutationFn: () => createTopic(newTopic.trim()),
    onSuccess: (created) => {
      queryClient.invalidateQueries({queryKey: queryKeys.topics})
      setTopicId(created.id)
      setNewTopic('')
      setAddingTopic(false)
    },
    onError: () => setFeedback({ok: false, msg: 'Could not create topic — name may already exist.'}),
  })

  async function translateOnly() {
    if (!term.trim()) { setFeedback({ok: false, msg: 'Enter a word first.'}); termRef.current?.focus(); return }
    setTranslating(true); setFeedback(null)
    const result = await translateTerm(term.trim())
    setTranslating(false)
    if (result) { setTranslation(result) }
    else { setFeedback({ok: false, msg: 'Translation not found — please enter it manually.'}) }
  }

  async function suggestOnly() {
    if (!term.trim()) { setFeedback({ok: false, msg: 'Enter a word first.'}); termRef.current?.focus(); return }
    if (!translation.trim()) { setFeedback({ok: false, msg: 'Enter a translation first so AI can suggest a topic.'}); return }
    setSuggesting(true); setFeedback(null)
    const suggested = await suggestTopic(term.trim(), translation.trim())
    setSuggesting(false)
    if (!suggested) { setFeedback({ok: false, msg: 'Could not suggest a topic — please select one manually.'}); return }
    const match = topics.find((t) => t.name === suggested)
    if (match) { setTopicId(match.id); setAiSuggested(true) }
    else { setFeedback({ok: false, msg: `AI suggested "${suggested}" but it wasn't found in your topics.`}) }
  }

  async function autoFill() {
    if (!term.trim()) { setFeedback({ok: false, msg: 'Enter a word first.'}); termRef.current?.focus(); return }
    setFeedback(null)
    setTranslating(true)
    const result = await translateTerm(term.trim())
    setTranslating(false)
    if (!result) { setFeedback({ok: false, msg: 'Translation not found — please enter it manually.'}); return }
    setTranslation(result)
    setSuggesting(true)
    const suggested = await suggestTopic(term.trim(), result)
    setSuggesting(false)
    if (suggested) {
      const match = topics.find((t) => t.name === suggested)
      if (match) { setTopicId(match.id); setAiSuggested(true) }
    }
  }

  async function save() {
    if (!term.trim()) { setFeedback({ok: false, msg: 'Word or phrase is required.'}); termRef.current?.focus(); return }
    if (!translation.trim()) { setFeedback({ok: false, msg: 'Translation is required.'}); return }
    setFeedback(null)
    let resolvedTopicId = topicId
    if (!resolvedTopicId) {
      const inboxId = await ensureInbox(topics, (id) => {
        queryClient.invalidateQueries({queryKey: queryKeys.topics})
        setTopicId(id)
      })
      if (!inboxId) { setFeedback({ok: false, msg: 'Could not create Inbox topic. Please select a topic manually.'}); return }
      resolvedTopicId = inboxId
    }
    addWordMutation.mutate(resolvedTopicId)
  }

  const sortedTopics = [
    ...topics.filter((t) => t.name === INBOX_TOPIC_NAME),
    ...topics.filter((t) => t.name !== INBOX_TOPIC_NAME).sort((a, b) => a.name.localeCompare(b.name)),
  ]

  return {
    termRef,
    term, setTerm,
    translation, setTranslation: (v: string) => { setTranslation(v); setAiSuggested(false) },
    topicId, setTopicId: (id: number) => { setTopicId(id); setAiSuggested(false) },
    newTopic, setNewTopic,
    addingTopic, setAddingTopic,
    translating, suggesting, aiSuggested,
    feedback,
    topicsLoading: topicsQuery.isLoading,
    sortedTopics,
    savePending: addWordMutation.isPending,
    createTopicPending: createTopicMutation.isPending,
    canSave: term.trim().length > 0 && translation.trim().length > 0 && !addWordMutation.isPending,
    save, translateOnly, suggestOnly, autoFill,
    createTopic: () => createTopicMutation.mutate(),
    cancelNewTopic: () => { setAddingTopic(false); setNewTopic('') },
  }
}
EOF

write_file "$USE_WORD_PAGE_STATE" <<'EOF'
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

  const topicWords = useMemo(() => {
    const allWords = allWordsQuery.data ?? []
    if (!word || !topic) return []
    return allWords
      .filter((w) => w.topic_ids.includes(topic.id))
      .sort((a, b) => a.term.localeCompare(b.term))
  }, [allWordsQuery.data, word, topic])

  const currentIdx = topicWords.findIndex((w) => w.id === word?.id)
  const prevWord = currentIdx > 0 ? topicWords[currentIdx - 1] : null
  const nextWord = currentIdx >= 0 && currentIdx < topicWords.length - 1 ? topicWords[currentIdx + 1] : null

  useEffect(() => {
    if (!editing) {
      setDraft(null)
      return
    }
    if (!word) return
    setDraft((currentDraft) => currentDraft ?? toEditState(word))
  }, [editing, word])

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

cd "$FRONTEND_DIR"

rm -rf dist
find . -maxdepth 1 -name '*.tsbuildinfo' -delete

npm run lint
npm run test
npm run build

echo
echo "Lexora frontend hook warning fix applied successfully."
echo "Backup created in: ${backup_dir#$ROOT_DIR/}"
echo
echo "Cleaned files:"
echo "  - frontend/dist (rebuilt fresh)"
echo "  - frontend/*.tsbuildinfo"
