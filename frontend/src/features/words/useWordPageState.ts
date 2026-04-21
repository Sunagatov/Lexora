import {useState, useMemo, useEffect, useRef} from 'react'
import {useParams, useNavigate, useLocation} from 'react-router-dom'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {fetchWord, fetchWords, updateWord, deleteWord} from './api'
import {fetchTopics} from '../topics/api'
import type {Word} from '../../shared/types'
import {ApiError} from '../../shared/apiError'
import {queryKeys} from '../../shared/queryKeys'
import {routes} from '../../shared/routes'
import {type EditState, toEditState, buildSavePayload} from './wordForm'
import {buildWordLocationState, resolveWordContextTopic} from './wordPageContext'

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
  const isValidWordId = Number.isInteger(numericWordId) && numericWordId > 0

  const wordQuery = useQuery({
    queryKey: isValidWordId ? queryKeys.word(numericWordId) : ['word', 'invalid', wordId ?? 'missing'],
    queryFn: () => fetchWord(numericWordId),
    enabled: isValidWordId,
  })

  const topicsQuery = useQuery({
    queryKey: queryKeys.topics,
    queryFn: fetchTopics,
    enabled: isValidWordId,
  })

  const allWordsQuery = useQuery({
    queryKey: queryKeys.words,
    queryFn: () => fetchWords(),
    enabled: isValidWordId,
  })

  const word = wordQuery.data
  const topics = topicsQuery.data ?? []
  const topic = word ? resolveWordContextTopic(word, topics, fromTopicSlug) : undefined
  const wordIdForEffect = word?.id

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Word>) => updateWord(numericWordId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.word(updated.id), updated)

      queryClient.setQueriesData<Word[]>({queryKey: queryKeys.words}, (cur = []) =>
        cur.map((w) => (w.id === updated.id ? updated : w)),
      )

      void queryClient.invalidateQueries({queryKey: queryKeys.words})
      void queryClient.invalidateQueries({queryKey: queryKeys.stats})
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})

      navigate(routes.word(updated.id), {
        replace: true,
        state: buildWordLocationState(updated, topics, fromTopicSlug),
      })

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
  const draftWordIdRef = useRef<number | null>(null)

  const deleteMutation = useMutation({
    mutationFn: () => deleteWord(numericWordId),
    onSuccess: () => {
      queryClient.setQueriesData<Word[]>({queryKey: queryKeys.words}, (cur = []) =>
        cur.filter((w) => w.id !== numericWordId),
      )

      queryClient.removeQueries({queryKey: queryKeys.word(numericWordId)})
      void queryClient.invalidateQueries({queryKey: queryKeys.words})
      void queryClient.invalidateQueries({queryKey: queryKeys.stats})
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
      void queryClient.invalidateQueries({queryKey: queryKeys.trashWords})

      navigate(
        capturedTopicSlug.current ? routes.topic(capturedTopicSlug.current) : routes.home,
        {replace: true},
      )
    },
  })

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
      draftWordIdRef.current = null
      setSaveError(null)
      return
    }

    if (!wordIdForEffect) return

    if (draftWordIdRef.current !== wordIdForEffect) {
      setDraft(toEditState(word))
      draftWordIdRef.current = wordIdForEffect
      setSaveError(null)
    }
  }, [editing, wordIdForEffect, word])

  function set(field: keyof EditState, value: string | string[]) {
    setDraft((d) => (d ? {...d, [field]: value} : d))
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
    capturedTopicSlug.current = word
      ? (buildWordLocationState(word, topics, fromTopicSlug)?.fromTopicSlug ?? null)
      : null

    setConfirming(false)
    deleteMutation.mutate()
  }

  return {
    wordId: numericWordId,
    isInvalidWordId: !isValidWordId,
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
    isLoading: isValidWordId && (wordQuery.isLoading || topicsQuery.isLoading || allWordsQuery.isLoading),
  }
}
