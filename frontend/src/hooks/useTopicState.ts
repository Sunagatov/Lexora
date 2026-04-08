import {useEffect, useMemo, useState} from 'react'
import type {Topic, Word} from '../lib/api'

export function useTopicState(topics: Topic[], words: Word[]) {
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const [topicSearch, setTopicSearch]         = useState('')
  const [drawerOpen, setDrawerOpen]           = useState(false)

  useEffect(() => {
    if (!topics.length) return
    if (selectedTopicId === null || !topics.some((t) => t.id === selectedTopicId)) {
      setSelectedTopicId(topics[0].id)
    }
  }, [topics, selectedTopicId])

  const topicCounts = useMemo(() => {
    const m = new Map<number, number>()
    for (const w of words) m.set(w.topic_id, (m.get(w.topic_id) ?? 0) + 1)
    return m
  }, [words])

  const topicPos = useMemo(() => {
    const m = new Map<number, string>()
    for (const w of words) {
      if (!m.has(w.topic_id) && w.part_of_speech) m.set(w.topic_id, w.part_of_speech)
    }
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

  return {
    selectedTopicId,
    selectedTopic,
    visibleTopics,
    topicCounts,
    topicPos,
    topicSearch,
    setTopicSearch,
    drawerOpen,
    setDrawerOpen,
    selectTopic: (id: number) => { setSelectedTopicId(id); setDrawerOpen(false) },
  }
}
