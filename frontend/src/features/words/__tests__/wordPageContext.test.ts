import {describe, it, expect} from 'vitest'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {Word} from '@/features/words/types/wordTypes'
import {buildWordLocationState, resolveWordContextTopic} from '@/features/words/model/wordPageContext'

function makeTopic(id: number, slug: string, name = slug, parent_topic_id: number | null = null): Topic {
  return {
    id,
    slug,
    name,
    description: null,
    parent_topic_id,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
}

function makeWord(topic_ids: number[]): Pick<Word, 'topic_ids'> {
  return {topic_ids}
}

describe('resolveWordContextTopic', () => {
  const topics = [
    makeTopic(1, 'alpha'),
    makeTopic(2, 'beta'),
    makeTopic(3, 'gamma'),
  ]

  it('keeps preferred slug when the word still belongs to it', () => {
    const result = resolveWordContextTopic(makeWord([2, 1]), topics, 'beta')
    expect(result?.slug).toBe('beta')
  })

  it('falls back to the first real word topic when preferred slug is stale', () => {
    const result = resolveWordContextTopic(makeWord([2]), topics, 'alpha')
    expect(result?.slug).toBe('beta')
  })

  it('keeps preferred slug when it is an ancestor of the word topic in the backend subtree view', () => {
    const subtreeTopics = [
      makeTopic(1, 'parent'),
      makeTopic(2, 'child', 'child', 1),
      makeTopic(3, 'other'),
    ]

    const result = resolveWordContextTopic(makeWord([2]), subtreeTopics, 'parent')
    expect(result?.slug).toBe('parent')
  })

  it('returns undefined when the word has no topics', () => {
    const result = resolveWordContextTopic(makeWord([]), topics, 'alpha')
    expect(result).toBeUndefined()
  })

  it('returns first matching topic in topics order when no preferred slug given', () => {
    // topics array order is [alpha(1), beta(2), gamma(3)], so alpha is found first
    const result = resolveWordContextTopic(makeWord([3, 1]), topics)
    expect(result?.slug).toBe('alpha')
  })
})

describe('buildWordLocationState', () => {
  const topics = [
    makeTopic(1, 'alpha'),
    makeTopic(2, 'beta'),
  ]

  it('builds location state from a valid preferred slug', () => {
    expect(buildWordLocationState(makeWord([2]), topics, 'beta')).toEqual({fromTopicSlug: 'beta'})
  })

  it('drops stale preferred slug and uses the real topic instead', () => {
    expect(buildWordLocationState(makeWord([2]), topics, 'alpha')).toEqual({fromTopicSlug: 'beta'})
  })

  it('preserves a preferred parent topic slug for subtree-scoped topic pages', () => {
    const subtreeTopics = [
      makeTopic(1, 'parent'),
      makeTopic(2, 'child', 'child', 1),
    ]

    expect(buildWordLocationState(makeWord([2]), subtreeTopics, 'parent')).toEqual({fromTopicSlug: 'parent'})
  })

  it('returns undefined when word has no topics', () => {
    expect(buildWordLocationState(makeWord([]), topics, 'beta')).toBeUndefined()
  })
})
