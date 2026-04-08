import {useEffect, useMemo, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import type {Topic, Word} from '../lib/api'

export function useTopicState(topics: Topic[], words: Word[]) {
  const {topicId} = useParams<{topicId?: string}>()
  const navigate  = useNavigate()
  const [topicSearch, setTopicSearch] = useState('')
  const [drawerOpen, setDrawerOpen]   = useState(false)

  const selectedTopicId = topicId ? parseInt(topicId, 10) : null

  // When topics load and no topicId in URL, do not auto-select — smart-review is the default
  useEffect(() => {
    if (!topics.length) return
    if (selectedTopicId !== null && !topics.some((t) => t.id === selectedTopicId)) {
      navigate('/study/smart-review', {replace: true})
    }
  }, [topics, selectedTopicId, navigate])

  const topicCounts = useMemo(() => {
    const m = new Map<number, number>()
    for (const w of words) m.set(w.topic_id, (m.get(w.topic_id) ?? 0) + 1)
    return m
  }, [words])

  const visibleTopics = useMemo(() => {
    const needle = topicSearch.toLowerCase().trim()
    return topics.filter((t) =>
      !needle ||
      t.name.toLowerCase().includes(needle) ||
      (t.description ?? '').toLowerCase().includes(needle),
    )
  }, [topicSearch, topics])

  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === selectedTopicId) ?? null,
    [topics, selectedTopicId],
  )

  function selectTopic(id: number) {
    navigate(`/study/topics/${id}`)
    setDrawerOpen(false)
  }

  function selectSmartReview() {
    navigate('/study/smart-review')
    setDrawerOpen(false)
  }

  return {
    selectedTopicId,
    selectedTopic,
    visibleTopics,
    topicCounts,
    topicSearch,
    setTopicSearch,
    drawerOpen,
    setDrawerOpen,
    selectTopic,
    selectSmartReview,
  }
}
