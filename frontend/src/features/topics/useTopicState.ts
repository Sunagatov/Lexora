import {useEffect, useMemo, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import type {Topic, Word} from '../../shared/http'
import {routes} from '../../shared/routes'

export function useTopicState(topics: Topic[], words: Word[]) {
  const {topicSlug} = useParams<{topicSlug?: string}>()
  const navigate    = useNavigate()
  const [topicSearch, setTopicSearch] = useState('')
  const [recentIds,   setRecentIds]   = useState<number[]>(() => {
    try { return JSON.parse(localStorage.getItem('sidebar_recent_topics') ?? '[]') } catch { return [] }
  })

  const selectedTopic   = useMemo(() => topics.find((t) => t.slug === topicSlug) ?? null, [topics, topicSlug])
  const selectedTopicId = selectedTopic?.id ?? null

  useEffect(() => {
    if (!topics.length || !topicSlug) return
    if (!topics.some((t) => t.slug === topicSlug)) navigate(routes.home, {replace: true})
  }, [topics, topicSlug, navigate])

  const topicCounts = useMemo(() => {
    const m = new Map<number, number>()
    for (const w of words)
      for (const tid of w.topic_ids)
        m.set(tid, (m.get(tid) ?? 0) + 1)
    return m
  }, [words])

  const topicProgress = useMemo(() => {
    const scoreSum    = new Map<number, number>()
    const activeCount = new Map<number, number>()
    for (const w of words) {
      const lvl = w.knowledge_level
      if (!lvl || lvl < 1 || lvl > 4) continue
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

  function selectTopic(id: number) {
    const topic = topics.find((t) => t.id === id)
    if (topic) {
      navigate(routes.topic(topic.slug))
      try {
        const next = [id, ...recentIds.filter((x) => x !== id)].slice(0, 5)
        localStorage.setItem('sidebar_recent_topics', JSON.stringify(next))
        setRecentIds(next)
      } catch { /* ignore */ }
    }
  }

  function selectSmartReview() {
    navigate(routes.smartReview)
  }

  return {
    selectedTopicId, selectedTopic, topicCounts, topicProgress,
    topicSearch, setTopicSearch,
    recentIds,
    selectTopic, selectSmartReview,
  }
}
