import {useEffect, useMemo, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import type {Topic, Word} from '../lib/api'

export function useTopicState(topics: Topic[], words: Word[]) {
  const {topicSlug} = useParams<{topicSlug?: string}>()
  const navigate    = useNavigate()
  const [topicSearch, setTopicSearch] = useState('')
  const [drawerOpen, setDrawerOpen]   = useState(false)

  const selectedTopic = useMemo(
    () => topics.find((t) => t.slug === topicSlug) ?? null,
    [topics, topicSlug],
  )
  const selectedTopicId = selectedTopic?.id ?? null

  useEffect(() => {
    if (!topics.length || !topicSlug) return
    if (!topics.some((t) => t.slug === topicSlug)) {
      navigate('/smart-review', {replace: true})
    }
  }, [topics, topicSlug, navigate])

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

  function selectTopic(id: number) {
    const topic = topics.find((t) => t.id === id)
    if (topic) navigate(`/topics/${topic.slug}`)
    setDrawerOpen(false)
  }

  function selectSmartReview() {
    navigate('/smart-review')
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
