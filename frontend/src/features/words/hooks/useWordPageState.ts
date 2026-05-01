import {useState, useMemo, useEffect, useRef} from 'react'
import {useParams, useNavigate, useLocation} from 'react-router-dom'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {fetchWord, fetchWords, updateWord, deleteWord} from '@/features/words/api/wordsApi'
import {fetchTopics} from '@/features/topics/api/topicsApi'
import type {Word} from '@/features/words/types/wordTypes'
import {ApiError} from '@/shared/api/apiError'
import {queryKeys} from '@/app/queryKeys'
import {routes} from '@/app/routes'
import {type EditState, toEditState, buildSavePayload} from '@/features/words/model/wordForm'
import {buildWordLocationState, resolveWordContextTopic, topicContainsWordThroughSubtree} from '@/features/words/model/wordPageContext'
import type {QueryClient} from '@tanstack/react-query'

const WORD_DEPENDENT_QUERY_KEYS = [
  queryKeys.words,
  queryKeys.topicSidebar,
  queryKeys.stats,
  queryKeys.smartReview,
] as const

function replaceWordInWordLists(queryClient: QueryClient, updated: Word) {
  queryClient.setQueryData(queryKeys.word(updated.id), updated)
  queryClient.setQueriesData<Word[]>({queryKey: queryKeys.words}, (current = []) =>
    current.map((word) => (word.id === updated.id ? updated : word)),
  )
}

function removeWordFromWordLists(queryClient: QueryClient, wordId: number) {
  queryClient.setQueriesData<Word[]>({queryKey: queryKeys.words}, (current = []) =>
    current.filter((word) => word.id !== wordId),
  )
  queryClient.removeQueries({queryKey: queryKeys.word(wordId)})
}

function invalidateWordDependencies(queryClient: QueryClient, extras: readonly (readonly unknown[])[] = []) {
  for (const queryKey of [...WORD_DEPENDENT_QUERY_KEYS, ...extras]) {
    void queryClient.invalidateQueries({queryKey})
  }
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
  const topics = useMemo(() => topicsQuery.data ?? [], [topicsQuery.data])
  const topic = word ? resolveWordContextTopic(word, topics, fromTopicSlug) : undefined
  const wordIdForEffect = word?.id

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Word>) => updateWord(numericWordId, payload),
    onSuccess: (updated) => {
      replaceWordInWordLists(queryClient, updated)
      invalidateWordDependencies(queryClient)

      navigate(routes.word(updated.id), {
        replace: true,
        state: buildWordLocationState(updated, topics, fromTopicSlug),
      })

      setDraft(null)
      setSaveError(null)
    },
    onError: (err: Error) => {
      const msg = err instanceof ApiError && err.status === 409
        ? 'A word with this term already exists in your library.'
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
      removeWordFromWordLists(queryClient, numericWordId)
      invalidateWordDependencies(queryClient, [queryKeys.trashWords])

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
      .filter((w) => topicContainsWordThroughSubtree(topic.id, w.topic_ids, topics))
      .sort((a, b) => a.term.localeCompare(b.term))
  }, [allWordsQuery.data, word, topic, topics])

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
    deletePending: deleteMutation.isPending,
    confirming,
    setConfirming,
    handleDelete,
    fromTopicSlug,
    isLoading: isValidWordId && (wordQuery.isLoading || topicsQuery.isLoading || allWordsQuery.isLoading),
  }
}
