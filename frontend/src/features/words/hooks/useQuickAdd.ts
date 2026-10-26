import {useEffect, useMemo, useRef, useState} from 'react'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {createTopic, fetchTopics} from '@/features/topics/api/topicsApi'
import {quickAddWord, enrichWord} from '@/features/words/api/wordsApi'
import {ApiError} from '@/shared/api/apiError'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {EnrichResult} from '@/features/words/types/wordTypes'
import {queryKeys} from '@/app/queryKeys'
import {ensureInboxTopic, findTopicByName} from '@/features/words/api/quickAddAssistApi'
import {invalidateWordDependencies} from '@/features/words/model/wordCache'

const INBOX_TOPIC_NAME = 'Inbox'
const isInboxTopic = (topic: Topic) => topic.name.trim().toLowerCase() === INBOX_TOPIC_NAME.toLowerCase()
const EMPTY_TOPICS: Topic[] = []
type QuickAddPayload = Parameters<typeof quickAddWord>[0]

function sortQuickAddTopics(topics: Topic[]): Topic[] {
  const inboxTopics: Topic[] = []
  const otherTopics: Topic[] = []
  for (const topic of topics) {
    if (isInboxTopic(topic)) inboxTopics.push(topic)
    else otherTopics.push(topic)
  }
  otherTopics.sort((a, b) => a.name.localeCompare(b.name))
  return [...inboxTopics, ...otherTopics]
}

export function useQuickAdd() {
  const queryClient = useQueryClient()
  const termRef = useRef<HTMLInputElement>(null)
  const enrichmentVersion = useRef(0)
  const saveInProgress = useRef(false)
  const autoTranslation = useRef<string | null>(null)

  const [term, setTerm] = useState('')
  const [translation, setTranslation] = useState('')
  const [topicId, setTopicId] = useState<number | null>(null)
  const [newTopic, setNewTopic] = useState('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [feedback, setFeedback] = useState<{ok: boolean; msg: string} | null>(null)
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null)
  const [enrichDone, setEnrichDone] = useState(false)
  const [enriching, setEnriching] = useState(false)

  const topicsQuery = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})
  const topics: Topic[] = topicsQuery.data ?? EMPTY_TOPICS

  useEffect(() => {
    if (topicId !== null || topics.length === 0) return
    const inbox = findTopicByName(topics, INBOX_TOPIC_NAME)
    if (inbox) setTopicId(inbox.id)
  }, [topics, topicId])

  function focusTermInput() { termRef.current?.focus() }

  function resetMarkers() {
    setEnrichResult(null)
    setEnrichDone(false)
  }

  function buildSavePayload(resolvedTopicId: number | null): QuickAddPayload {
    const base: QuickAddPayload = {
      term: term.trim(),
      topic_ids: resolvedTopicId ? [resolvedTopicId] : [],
      translation_entries: [translation.trim()],
      knowledge_level: 1,
    }
    if (!enrichResult) return base

    const er = enrichResult
    if (er.definition) base.definition = er.definition
    if (er.pronunciation_ipa) base.pronunciation_ipa = er.pronunciation_ipa
    if (er.pronunciation_audio_url) base.pronunciation_audio_url = er.pronunciation_audio_url
    if (er.part_of_speech) base.part_of_speech = er.part_of_speech
    if (er.cefr_level) base.cefr_level = er.cefr_level
    if (er.register) base.register = er.register
    if (er.countability) base.countability = er.countability
    if (er.frequency_rank) base.frequency_rank = er.frequency_rank
    if (er.pattern) base.pattern = er.pattern
    if (er.notes) base.notes = er.notes
    if (er.translation_entries.length > 0) {
      // Prepend user's manual translation if it differs from AI translations
      const userTrans = translation.trim()
      const aiHasUserTrans = er.translation_entries.some((t) => t.toLowerCase() === userTrans.toLowerCase())
      base.translation_entries = aiHasUserTrans ? er.translation_entries : [userTrans, ...er.translation_entries]
    }
    if (er.example_entries.length > 0) base.example_entries = er.example_entries
    if (er.synonym_entries.length > 0) base.synonym_entries = er.synonym_entries
    if (er.antonym_entries.length > 0) base.antonym_entries = er.antonym_entries
    if (er.collocation_entries.length > 0) base.collocation_entries = er.collocation_entries
    if (er.confusable_entries.length > 0) base.confusable_entries = er.confusable_entries
    if (er.verb_form) base.verb_form = er.verb_form
    return base
  }

  const addWordMutation = useMutation({
    mutationFn: async (payload: QuickAddPayload) => {
      let resolvedTopicId = payload.topic_ids[0]
      if (!resolvedTopicId) {
        const inboxId = await ensureInboxTopic(topics, (id) => {
          void queryClient.invalidateQueries({queryKey: queryKeys.topics})
          void queryClient.invalidateQueries({queryKey: queryKeys.stats})
          setTopicId(id)
        })
        if (!inboxId) throw new ApiError(400, 'Could not create Inbox topic. Please select a topic manually.')
        resolvedTopicId = inboxId
      }
      return quickAddWord({...payload, topic_ids: [resolvedTopicId]})
    },
    onSuccess: (_created, payload) => {
      invalidateWordDependencies(queryClient)
      enrichmentVersion.current++
      setEnriching(false)
      setFeedback({ok: true, msg: `"${payload.term}" saved!`})
      setTerm('')
      setTranslation('')
      autoTranslation.current = null
      resetMarkers()
      setTimeout(() => { setFeedback(null); focusTermInput() }, 1800)
    },
    onError: (err: Error, payload) => {
      const msg = err instanceof ApiError && err.status === 409
        ? `"${payload.term}" already exists in your library`
        : err instanceof ApiError && err.status === 400 ? err.message : 'Failed to save. Try again.'
      setFeedback({ok: false, msg})
    },
    onSettled: () => { saveInProgress.current = false },
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

  async function enrich() {
    const trimmedTerm = term.trim()
    if (!trimmedTerm) {
      setFeedback({ok: false, msg: 'Enter a word first.'})
      focusTermInput()
      return
    }

    resetMarkers()
    const version = ++enrichmentVersion.current
    setEnriching(true)
    setFeedback(null)

    try {
      const result = await enrichWord(trimmedTerm)
      if (version !== enrichmentVersion.current) return
      setEnrichResult(result)
      setEnrichDone(true)

      if (result.translation_entries.length > 0) {
        setTranslation(current => {
          if (current.trim()) return current
          autoTranslation.current = result.translation_entries[0]
          return autoTranslation.current
        })
      }
    } catch {
      if (version === enrichmentVersion.current) {
        setFeedback({ok: false, msg: 'Enrichment failed — you can still save manually.'})
      }
    } finally {
      if (version === enrichmentVersion.current) setEnriching(false)
    }
  }

  async function save() {
    const trimmedTerm = term.trim()
    const trimmedTranslation = translation.trim()

    if (saveInProgress.current || addingTopic || createTopicMutation.isPending) return
    if (!trimmedTerm) {
      setFeedback({ok: false, msg: 'Word or phrase is required.'})
      focusTermInput()
      return
    }
    if (!trimmedTranslation) {
      setFeedback({ok: false, msg: 'Translation is required.'})
      return
    }
    setFeedback(null)

    saveInProgress.current = true
    addWordMutation.mutate(buildSavePayload(topicId))
  }

  const sortedTopics = useMemo(() => sortQuickAddTopics(topics), [topics])

  return {
    termRef,
    term, setTerm: (value: string) => {
      enrichmentVersion.current++
      const previousAutoTranslation = autoTranslation.current
      if (previousAutoTranslation !== null) setTranslation(current => current === previousAutoTranslation ? '' : current)
      autoTranslation.current = null
      setTerm(value)
      resetMarkers()
      setEnriching(false)
    },
    translation, setTranslation: (value: string) => { autoTranslation.current = null; setTranslation(value) },
    topicId, setTopicId: (id: number) => { setTopicId(id) },
    newTopic, setNewTopic,
    addingTopic, setAddingTopic,
    enriching,
    enrichResult,
    enrichDone,
    feedback,
    topicsLoading: topicsQuery.isLoading,
    sortedTopics,
    savePending: addWordMutation.isPending,
    createTopicPending: createTopicMutation.isPending,
    canSave: term.trim().length > 0 && translation.trim().length > 0 && !addWordMutation.isPending && !addingTopic && !createTopicMutation.isPending,
    save, enrich,
    createTopic: () => {
      if (!newTopic.trim() || createTopicMutation.isPending) return
      createTopicMutation.mutate()
    },
    cancelNewTopic: () => { if (!createTopicMutation.isPending) { setAddingTopic(false); setNewTopic('') } },
  }
}
