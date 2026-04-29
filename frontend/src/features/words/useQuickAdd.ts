import {useEffect, useMemo, useRef, useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {createTopic, fetchTopics} from '../topics/api'
import {quickAddWord} from './api'
import {ApiError} from '../../shared/apiError'
import type {Topic} from '../../shared/types'
import {queryKeys} from '../../app/queryKeys'
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
      void queryClient.invalidateQueries({queryKey: queryKeys.words})
      void queryClient.invalidateQueries({queryKey: queryKeys.topicSidebar})
      void queryClient.invalidateQueries({queryKey: queryKeys.stats})
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
      setFeedback({ok: true, msg: `"${term.trim()}" saved!`})
      setTerm('')
      setTranslation('')
      setAiSuggested(false)
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
    if (addWordMutation.isPending) return
    if (!term.trim()) { setFeedback({ok: false, msg: 'Word or phrase is required.'}); termRef.current?.focus(); return }
    if (!translation.trim()) { setFeedback({ok: false, msg: 'Translation is required.'}); return }
    setFeedback(null)
    let resolvedTopicId = topicId
    if (!resolvedTopicId) {
      const inboxId = await ensureInbox(topics, (id) => {
        void queryClient.invalidateQueries({queryKey: queryKeys.topics})
        void queryClient.invalidateQueries({queryKey: queryKeys.stats})
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
    createTopic: () => {
      if (!newTopic.trim() || createTopicMutation.isPending) return
      createTopicMutation.mutate()
    },
    cancelNewTopic: () => { setAddingTopic(false); setNewTopic('') },
  }
}
