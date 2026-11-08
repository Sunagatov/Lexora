import {describe, expect, it} from 'vitest'
import {createTopicLabeler} from '@/features/topics/model/topicLabels'
import type {Topic} from '@/features/topics/types/topicTypes'

describe('topic labels', () => {
  it('includes every available ancestor and tolerates missing parents and cycles', () => {
    const topics = [
      {id: 1, name: 'Learning'},
      {id: 2, name: 'Reading', parent_topic_id: 1},
      {id: 3, name: 'Books', parent_topic_id: 2},
      {id: 4, name: 'Orphan', parent_topic_id: 999},
      {id: 5, name: 'Cycle A', parent_topic_id: 6},
      {id: 6, name: 'Cycle B', parent_topic_id: 5},
    ] as Topic[]
    const label = createTopicLabeler(topics)
    expect(topics.map(label)).toEqual([
      'Learning', 'Learning / Reading', 'Learning / Reading / Books',
      'Orphan', 'Cycle B / Cycle A', 'Cycle A / Cycle B',
    ])
  })
})
