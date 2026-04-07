import {useEffect, useMemo, useState} from 'react'
import type {Topic, Word} from '../lib/api'

const MOBILE_BREAKPOINT = 860
export const PAGE_SIZE_DESKTOP = 20
export const PAGE_SIZE_MOBILE  = 12

function getPageSize() {
  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches
    ? PAGE_SIZE_MOBILE
    : PAGE_SIZE_DESKTOP
}

export function useTopicState(topics: Topic[], words: Word[]) {
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null)
  const [topicSearch, setTopicSearch]         = useState('')
  const [drawerOpen, setDrawerOpen]           = useState(false)
  const [pageSize, setPageSize]               = useState(getPageSize)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const handler = () => setPageSize(mq.matches ? PAGE_SIZE_MOBILE : PAGE_SIZE_DESKTOP)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
    pageSize,
    drawerOpen,
    setDrawerOpen,
    selectTopic: (id: number) => { setSelectedTopicId(id); setDrawerOpen(false) },
  }
}
