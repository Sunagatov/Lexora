import {useEffect, useMemo, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import type {Topic, Word} from '../../shared/types'
import {routes} from '../../shared/routes'

function buildDescendantMap(topics: Topic[]): Map<number, number[]> {
  const childrenByParent = new Map<number | null, number[]>()
  for (const topic of topics) {
    const parentId = topic.parent_topic_id ?? null
    const list = childrenByParent.get(parentId) ?? []
    list.push(topic.id)
    childrenByParent.set(parentId, list)
  }

  const memo = new Map<number, number[]>()
  const collect = (topicId: number): number[] => {
    const cached = memo.get(topicId)
    if (cached) return cached

    const descendants = [topicId]
    for (const childId of childrenByParent.get(topicId) ?? [])
      descendants.push(...collect(childId))

    const deduped = Array.from(new Set(descendants))
    memo.set(topicId, deduped)
    return deduped
  }

  for (const topic of topics)
    collect(topic.id)

  return memo
}

export function useTopicState(topics: Topic[], words: Word[]) {
  const {topicSlug} = useParams<{topicSlug?: string}>()
  const navigate    = useNavigate()
  const [topicSearch, setTopicSearch] = useState('')

  const selectedTopic   = useMemo(() => topics.find((t) => t.slug === topicSlug) ?? null, [topics, topicSlug])
  const selectedTopicId = selectedTopic?.id ?? null
  const descendantsByTopicId = useMemo(() => buildDescendantMap(topics), [topics])

  useEffect(() => {
    if (!topics.length || !topicSlug) return
    if (!topics.some((t) => t.slug === topicSlug)) navigate(routes.home, {replace: true})
  }, [topics, topicSlug, navigate])

  const topicCounts = useMemo(() => {
    const m = new Map<number, number>()
    for (const topic of topics) {
      const descendantIds = descendantsByTopicId.get(topic.id) ?? [topic.id]
      const descendantSet = new Set(descendantIds)
      let count = 0
      for (const w of words) {
        if (w.topic_ids.some((tid) => descendantSet.has(tid))) count += 1
      }
      m.set(topic.id, count)
    }
    return m
  }, [descendantsByTopicId, topics, words])

  const topicProgress = useMemo(() => {
    const result = new Map<number, number>()
    for (const topic of topics) {
      const descendantIds = descendantsByTopicId.get(topic.id) ?? [topic.id]
      const descendantSet = new Set(descendantIds)
      let scoreSum = 0
      let activeCount = 0

      for (const w of words) {
        const lvl = w.knowledge_level
        if (!lvl || lvl < 1 || lvl > 4) continue
        if (!w.topic_ids.some((tid) => descendantSet.has(tid))) continue

        scoreSum += (lvl - 1) / 3
        activeCount += 1
      }

      if (activeCount > 0)
        result.set(topic.id, Math.round((scoreSum / activeCount) * 100))
    }
    return result
  }, [descendantsByTopicId, topics, words])

  function selectTopic(id: number) {
    const topic = topics.find((t) => t.id === id)
    if (topic) navigate(routes.topic(topic.slug))
  }

  function selectSmartReview() {
    navigate(routes.smartReview)
  }

  return {
    selectedTopicId, selectedTopic, topicCounts, topicProgress,
    topicSearch, setTopicSearch,
    selectTopic, selectSmartReview,
  }
}
