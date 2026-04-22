import {useEffect, useMemo, useState} from 'react'
import {useNavigate, useParams} from 'react-router-dom'
import type {Topic} from '../../shared/types'
import {routes} from '../../shared/routes'

export function useTopicState(
  topics: Topic[],
  topicCounts = new Map<number, number>(),
  topicProgress = new Map<number, number>(),
) {
  const {topicSlug} = useParams<{topicSlug?: string}>()
  const navigate    = useNavigate()
  const [topicSearch, setTopicSearch] = useState('')

  const selectedTopic   = useMemo(() => topics.find((t) => t.slug === topicSlug) ?? null, [topics, topicSlug])
  const selectedTopicId = selectedTopic?.id ?? null

  useEffect(() => {
    if (!topics.length || !topicSlug) return
    if (!topics.some((t) => t.slug === topicSlug)) navigate(routes.home, {replace: true})
  }, [topics, topicSlug, navigate])

  function selectTopic(id: number) {
    const topic = topics.find((t) => t.id === id)
    if (topic) navigate({pathname: routes.topic(topic.slug), search: ''})
  }

  function selectSmartReview() {
    navigate({pathname: routes.smartReview, search: ''})
  }

  return {
    selectedTopicId, selectedTopic, topicCounts, topicProgress,
    topicSearch, setTopicSearch,
    selectTopic, selectSmartReview,
  }
}
