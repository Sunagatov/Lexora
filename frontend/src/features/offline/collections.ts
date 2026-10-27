import {displayTranslations, languagePreferences} from '@/features/languages/api'
import {filterAndSort} from '@/features/words/model/wordDomain'
import type {Word} from '@/features/words/types/wordTypes'
import type {FilterOptions} from '@/features/words/model/wordDomain'
import type {Replica} from './types'

export function inLanguage(item: {language?: string}) { return (item.language ?? 'en') === languagePreferences().language }
export function scopedReplica(replica: Replica): Replica {
  return {...replica, words: replica.words.filter(inLanguage), topics: replica.topics.filter(inLanguage)}
}

export function subtree(replica: Replica, root: number): number[] {
  const ids = new Set<number>()
  const visit = (id: number) => {
    if (ids.has(id)) return
    if (!replica.topics.some(t => t.id === id && !t.deleted_at && inLanguage(t))) return
    ids.add(id)
    replica.topics.filter(t => t.parent_topic_id === id && !t.deleted_at).forEach(t => visit(t.id))
  }
  visit(root)
  return [...ids]
}

export function visibleWord(replica: Replica, word: Word): Word {
  const active = new Set(replica.topics.filter(t => !t.deleted_at).map(t => t.id))
  return {...word, topic_ids: word.topic_ids.filter(id => active.has(id))}
}

export function listWords(replica: Replica, params: URLSearchParams) {
  let words = replica.words.filter(w => !w.deleted_at && inLanguage(w)).map(w => displayTranslations(visibleWord(replica, w)) as Word)
  const root = Number(params.get('topic_id'))
  if (root) {
    const ids = subtree(replica, root)
    words = words.filter(w => w.topic_ids.some(id => ids.includes(id)))
  }
  const topicIds = params.getAll('topic_ids').flatMap(id => subtree(replica, Number(id)))
  if (params.has('topic_ids') && !topicIds.length) words = []
  const sort = params.get('sort') ?? 'term-asc'
  const options = {
    search: params.get('search') ?? '',
    levelFilter: [...params.getAll('levels'), ...params.getAll('level')].map(Number),
    posFilter: [...params.getAll('positions'), ...params.getAll('pos')],
    cefrFilter: [...params.getAll('cefr_levels'), ...params.getAll('cefr')],
    completeness: params.get('completeness') ?? 'all',
    sortBy: sort,
    ...(params.has('then_sort') ? {thenSortBy: params.get('then_sort') === 'none' ? null : params.get('then_sort')} : {}),
    topicIds, frozenIds: null,
  } as FilterOptions
  words = filterAndSort(words, options)
  const page = Math.max(1, Number(params.get('page')) || 1)
  const pageSize = Math.min(200, Math.max(1, Number(params.get('page_size')) || 50))
  return {words: words.slice((page - 1) * pageSize, page * pageSize), total: words.length, page, page_size: pageSize,
    total_pages: Math.ceil(words.length / pageSize), ordered_ids: params.get('include_sequence') === 'true' ? words.map(word => word.id) : null}
}

export function sidebarStats(replica: Replica) {
  const words = replica.words.filter(w => !w.deleted_at && inLanguage(w))
  const topic_counts: Record<number, number> = {}, topic_progress: Record<number, number> = {}
  replica.topics.filter(t => !t.deleted_at && inLanguage(t)).forEach(topic => {
    const ids = subtree(replica, topic.id)
    const matching = words.filter(w => w.topic_ids.some(id => ids.includes(id)))
    topic_counts[topic.id] = matching.length
    const learning = matching.filter(w => w.knowledge_level && [1, 3, 4].includes(w.knowledge_level))
    topic_progress[topic.id] = learning.length ? Math.round(learning.reduce((sum, w) => sum + (w.knowledge_level! - 1), 0) * 100 / (3 * learning.length)) : 0
  })
  return {total_words: words.length, topic_counts, topic_progress}
}
