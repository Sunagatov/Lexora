import {useState, useMemo, useEffect, useRef} from 'react'
import {useParams, useNavigate, useLocation} from 'react-router-dom'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {fetchWord, updateWord, deleteWord} from './api'
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
  const {wordId}    = useParams<{wordId: string}>()
  const navigate    = useNavigate()
  const location    = useLocation()
  const queryClient = useQueryClient()
  const editing     = location.pathname.endsWith('/edit')
  const fromTopicSlug = (location.state as {fromTopicSlug?: string} | null)?.fromTopicSlug

  const [draft, setDraft]           = useState<EditState | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)

  const wordQuery   = useQuery({queryKey: queryKeys.word(Number(wordId)), queryFn: () => fetchWord(Number(wordId))})
  const topicsQuery = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Word>) => updateWord(Number(wordId), payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.word(Number(wordId)), updated)
      queryClient.setQueryData<Word[]>(queryKeys.words, (cur = []) => cur.map((w) => w.id === updated.id ? updated : w))
      navigate(routes.word(Number(wordId)), {replace: true, state: location.state})
      setDraft(null); setSaveError(null)
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
    mutationFn: () => deleteWord(Number(wordId)),
    onSuccess: () => {
      queryClient.setQueryData<Word[]>(queryKeys.words, (cur = []) => cur.filter((w) => w.id !== Number(wordId)))
      queryClient.removeQueries({queryKey: queryKeys.word(Number(wordId))})
      navigate(capturedTopicSlug.current ? routes.topic(capturedTopicSlug.current) : routes.home, {replace: true})
    },
  })

  const word   = wordQuery.data
  const topics = topicsQuery.data ?? []
  const topic  = word ? resolveTopic(word, topics, fromTopicSlug) : undefined

  const allWords   = queryClient.getQueryData<Word[]>(queryKeys.words) ?? []
  const topicWords = useMemo(
    () => word && topic
      ? allWords.filter((w) => w.topic_ids.includes(topic.id)).sort((a, b) => a.term.localeCompare(b.term))
      : [],
    [allWords, word, topic],
  )
  const currentIdx = topicWords.findIndex((w) => w.id === word?.id)
  const prevWord   = currentIdx > 0 ? topicWords[currentIdx - 1] : null
  const nextWord   = currentIdx >= 0 && currentIdx < topicWords.length - 1 ? topicWords[currentIdx + 1] : null

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
    const termVal  = draft.term.trim()
    const transVal = draft.translations.trim()
    const topicIds = draft.topic_ids.map(Number).filter((n) => n > 0)
    if (!termVal)         { setSaveError('Term cannot be empty.'); return }
    if (!transVal)        { setSaveError('Translation cannot be empty.'); return }
    if (!topicIds.length) { setSaveError('Please select a topic.'); return }
    const isVerb = draft.part_of_speech === 'verb'
    const isNoun = draft.part_of_speech === 'noun'
    saveMutation.mutate(buildSavePayload(draft, isVerb, isNoun))
  }

  function handleDelete() {
    capturedTopicSlug.current = topic?.slug ?? null
    setConfirming(false)
    deleteMutation.mutate()
  }

  return {
    wordId: Number(wordId), editing, location,
    word, topics, topic, topicWords, currentIdx, prevWord, nextWord,
    draft, set, save, saveError, setSaveError,
    savePending: saveMutation.isPending,
    confirming, setConfirming, handleDelete,
    isLoading: wordQuery.isLoading || topicsQuery.isLoading,
  }
}
