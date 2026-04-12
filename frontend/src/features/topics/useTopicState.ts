import {useEffect, useMemo, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import type {Topic, Word} from '../../shared/http'

export function useTopicState(topics: Topic[], words: Word[]) {
  const {topicSlug} = useParams<{topicSlug?: string}>()
  const navigate    = useNavigate()
  const [topicSearch, setTopicSearch] = useState('')
  const [drawerOpen, setDrawerOpen]   = useState(false)

  const selectedTopic   = useMemo(() => topics.find((t) => t.slug === topicSlug) ?? null, [topics, topicSlug])
  const selectedTopicId = selectedTopic?.id ?? null

  useEffect(() => {
    if (!topics.length || !topicSlug) return
    if (!topics.some((t) => t.slug === topicSlug)) navigate('/', {replace: true})
  }, [topics, topicSlug, navigate])

  const topicCounts = useMemo(() => {
    const m = new Map<number, number>()
    for (const w of words)
      for (const tid of w.topic_ids)
        m.set(tid, (m.get(tid) ?? 0) + 1)
    return m
  }, [words])

  // Progress per topic: weighted average of knowledge levels 1-4 (level 5 excluded).
  // score per word = (level - 1) / 3  →  level1=0%, level2=33%, level3=67%, level4=100%
  // topic progress = sum(scores) / count_of_active_words × 100
  const topicProgress = useMemo(() => {
    const scoreSum   = new Map<number, number>()
    const activeCount = new Map<number, number>()
    for (const w of words) {
      const lvl = w.knowledge_level
      if (!lvl || lvl < 1 || lvl > 4) continue   // skip null, unset, parked (5)
      const score = (lvl - 1) / 3
      for (const tid of w.topic_ids) {
        scoreSum.set(tid,    (scoreSum.get(tid)    ?? 0) + score)
        activeCount.set(tid, (activeCount.get(tid) ?? 0) + 1)
      }
    }
    const result = new Map<number, number>()
    for (const [tid, total] of activeCount)
      result.set(tid, Math.round(((scoreSum.get(tid) ?? 0) / total) * 100))
    return result
  }, [words])

  const visibleTopics = useMemo(() => {
    const needle = topicSearch.toLowerCase().trim()
    return topics.filter((t) =>
      !needle || t.name.toLowerCase().includes(needle) || (t.description ?? '').toLowerCase().includes(needle),
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
    selectedTopicId, selectedTopic, visibleTopics, topicCounts, topicProgress,
    topicSearch, setTopicSearch, drawerOpen, setDrawerOpen,
    selectTopic, selectSmartReview,
  }
}
