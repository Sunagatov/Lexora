import {useEffect, useRef, useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {createTopic, fetchTopics} from '@/features/topics/api/topicsApi'
import {quickAddWord} from '@/features/words/api/wordsApi'
import {ApiError} from '@/shared/api/apiError'
import type {Topic} from '@/features/topics/types/topicTypes'
import {queryKeys} from '@/app/queryKeys'
import {
  ensureInboxTopic,
  findTopicByName,
  suggestTopic,
  translateTerm,
} from '@/features/words/api/quickAddAssistApi'

const INBOX_TOPIC_NAME = 'Inbox'
const isInboxTopic = (topic: Topic) => findTopicByName([topic], INBOX_TOPIC_NAME) !== undefined

type AssistMode = 'idle' | 'translate' | 'suggest' | 'autofill'
type AssistStage = 'idle' | 'translating' | 'suggesting'
const EMPTY_TOPICS: Topic[] = []

export function useQuickAdd() {
  const queryClient = useQueryClient()
  const termRef     = useRef<HTMLInputElement>(null)

  const [term,        setTerm]        = useState('')
  const [translation, setTranslation] = useState('')
  const [topicId,     setTopicId]     = useState<number | null>(null)
  const [newTopic,    setNewTopic]    = useState('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [feedback,    setFeedback]    = useState<{ok: boolean; msg: string} | null>(null)
  const [assistMode, setAssistMode] = useState<AssistMode>('idle')
  const [assistStage, setAssistStage] = useState<AssistStage>('idle')
  const [translationAiDone, setTranslationAiDone] = useState(false)
  const [topicAiDone, setTopicAiDone] = useState(false)
  const [aiSuggested, setAiSuggested] = useState(false)

  const topicsQuery = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})
  const topics: Topic[] = topicsQuery.data ?? EMPTY_TOPICS

  useEffect(() => {
    if (topicId !== null || topics.length === 0) return
    const inbox = findTopicByName(topics, INBOX_TOPIC_NAME)
    if (inbox) setTopicId(inbox.id)
  }, [topics, topicId])

  function focusTermInput() {
    const input = termRef.current
    if (input !== null) {
      input.focus()
    }
  }

  function resetAssistMarkers() {
    setAiSuggested(false)
    setTranslationAiDone(false)
    setTopicAiDone(false)
  }

  function setAssist(mode: AssistMode, stage: AssistStage) {
    setAssistMode(mode)
    setAssistStage(stage)
  }

  function clearAssist() {
    setAssist('idle', 'idle')
  }

  function validateTerm(trimmedTerm: string): boolean {
    if (trimmedTerm.length > 0) return true
    setFeedback({ok: false, msg: 'Enter a word first.'})
    focusTermInput()
    return false
  }

  function validateTranslation(trimmedTranslation: string): boolean {
    if (trimmedTranslation.length > 0) return true
    setFeedback({ok: false, msg: 'Enter a translation first so AI can suggest a topic.'})
    return false
  }

  function applySuggestedTopic(suggested: string | null): boolean {
    if (!suggested) {
      setFeedback({ok: false, msg: 'Could not suggest a topic — please select one manually.'})
      return false
    }

    const match = findTopicByName(topics, suggested)
    if (!match) {
      setFeedback({ok: false, msg: `AI suggested "${suggested}" but it wasn't found in your topics.`})
      return false
    }

    setTopicId(match.id)
    setAiSuggested(true)
    setTopicAiDone(true)
    return true
  }

  const addWordMutation = useMutation({
    mutationFn: (resolvedTopicId: number) => quickAddWord(term.trim(), translation.trim(), [resolvedTopicId]),
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: queryKeys.words})
      void queryClient.invalidateQueries({queryKey: queryKeys.topicSidebar})
      void queryClient.invalidateQueries({queryKey: queryKeys.stats})
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
      setFeedback({ok: true, msg: `"${term.trim()}" saved!`})
      setTerm('')
      setTranslation('')
      resetAssistMarkers()
      setTimeout(() => { setFeedback(null); termRef.current?.focus() }, 1800)
    },
    onError: (err: Error) => {
      const msg = err instanceof ApiError && err.status === 409
        ? `"${term.trim()}" already exists in your library`
        : 'Failed to save. Try again.'
      setFeedback({ok: false, msg})
    },
  })

  const createTopicMutation = useMutation({
    mutationFn: () => createTopic(newTopic.trim()),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({queryKey: queryKeys.topics})
      void queryClient.invalidateQueries({queryKey: queryKeys.stats})
      setTopicId(created.id)
      setNewTopic('')
      setAddingTopic(false)
    },
    onError: (err: Error) => setFeedback({
      ok: false,
      msg: err instanceof ApiError && (err.status === 400 || err.status === 409)
        ? err.message
        : 'Could not create topic.',
    }),
  })

  async function requestTranslation(trimmedTerm: string) {
    setFeedback(null)
    const result = await translateTerm(trimmedTerm)
    if (!result) {
      setFeedback({ok: false, msg: 'Translation not found — please enter it manually.'})
      return null
    }
    setTranslation(result)
    setTranslationAiDone(true)
    return result
  }

  async function requestTopicSuggestion(trimmedTerm: string, trimmedTranslation: string) {
    setFeedback(null)
    const suggested = await suggestTopic(trimmedTerm, trimmedTranslation)
    applySuggestedTopic(suggested)
    return suggested
  }

  async function translateOnly() {
    const trimmedTerm = term.trim()
    if (!validateTerm(trimmedTerm)) return
    setAssist('translate', 'translating')
    await requestTranslation(trimmedTerm)
    clearAssist()
  }

  async function suggestOnly() {
    const trimmedTerm = term.trim()
    const trimmedTranslation = translation.trim()

    if (!validateTerm(trimmedTerm) || !validateTranslation(trimmedTranslation)) return
    setAssist('suggest', 'suggesting')
    await requestTopicSuggestion(trimmedTerm, trimmedTranslation)
    clearAssist()
  }

  async function autoFill() {
    const trimmedTerm = term.trim()
    if (!validateTerm(trimmedTerm)) return

    resetAssistMarkers()
    setAssist('autofill', 'translating')
    const translated = await requestTranslation(trimmedTerm)
    if (!translated) {
      clearAssist()
      return
    }

    setAssist('autofill', 'suggesting')
    await requestTopicSuggestion(trimmedTerm, translated)
    clearAssist()
  }

  async function save() {
    const trimmedTerm = term.trim()
    const trimmedTranslation = translation.trim()

    if (addWordMutation.isPending) return
    if (trimmedTerm.length === 0) {
      setFeedback({ok: false, msg: 'Word or phrase is required.'})
      focusTermInput()
      return
    }
    if (trimmedTranslation.length === 0) {
      setFeedback({ok: false, msg: 'Translation is required.'})
      return
    }
    setFeedback(null)
    let resolvedTopicId = topicId
    if (!resolvedTopicId) {
      const inboxId = await ensureInboxTopic(topics, (id) => {
        void queryClient.invalidateQueries({queryKey: queryKeys.topics})
        void queryClient.invalidateQueries({queryKey: queryKeys.stats})
        setTopicId(id)
      })
      if (!inboxId) {
        setFeedback({ok: false, msg: 'Could not create Inbox topic. Please select a topic manually.'})
        return
      }
      resolvedTopicId = inboxId
    }
    addWordMutation.mutate(resolvedTopicId)
  }

  const sortedTopics = [
    ...topics.filter(isInboxTopic),
    ...topics.filter((t) => !isInboxTopic(t)).sort((a, b) => a.name.localeCompare(b.name)),
  ]

  return {
    termRef,
    term, setTerm,
    translation, setTranslation: (v: string) => { setTranslation(v); setAiSuggested(false); setTranslationAiDone(false) },
    topicId, setTopicId: (id: number) => { setTopicId(id); setAiSuggested(false); setTopicAiDone(false) },
    newTopic, setNewTopic,
    addingTopic, setAddingTopic,
    translating: assistStage === 'translating',
    suggesting: assistStage === 'suggesting',
    aiSuggested,
    autoFillPending: assistMode === 'autofill' && assistStage !== 'idle',
    translationAiDone,
    topicAiDone,
    feedback,
    topicsLoading: topicsQuery.isLoading,
    sortedTopics,
    savePending: addWordMutation.isPending,
    createTopicPending: createTopicMutation.isPending,
    canSave: term.trim().length > 0 && translation.trim().length > 0 && !addWordMutation.isPending,
    save, translateOnly, suggestOnly, autoFill,
    createTopic: () => {
      if (!newTopic.trim() || createTopicMutation.isPending) return
      createTopicMutation.mutate()
    },
    cancelNewTopic: () => { setAddingTopic(false); setNewTopic('') },
  }
}
