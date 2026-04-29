import {describe, expect, it} from 'vitest'

import type {Topic} from '@/shared/types'
import {buildSidebarGroups} from '@/features/topics/model/topicSidebarModel'

function makeTopic(id: number, name: string, parent_topic_id: number | null = null): Topic {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    description: null,
    parent_topic_id,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('buildSidebarGroups', () => {
  it('nests subtopics under their parent topic', () => {
    const topics = [
      makeTopic(1, 'Home Chores DIY Repairs Appliances'),
      makeTopic(2, 'Cleaning and Laundry', 1),
      makeTopic(3, 'DIY Hand Tools', 1),
      makeTopic(4, 'Travel'),
    ]

    const result = buildSidebarGroups(
      topics,
      '',
      [],
      'default',
      'default',
      false,
      false,
      [],
      new Map(),
      new Map(),
    )

    expect(result.themeTree.map((node) => node.topic.id)).toEqual([1, 4])
    expect(result.themeTree[0].children.map((node) => node.topic.id)).toEqual([2, 3])
  })

  it('keeps pinned parent topics in the structural tree so children stay nested', () => {
    const topics = [
      makeTopic(1, 'Home Chores DIY Repairs Appliances'),
      makeTopic(2, 'Cleaning and Laundry', 1),
      makeTopic(3, 'DIY Hand Tools', 1),
      makeTopic(4, 'Travel'),
    ]

    const result = buildSidebarGroups(
      topics,
      '',
      [1],
      'default',
      'default',
      false,
      false,
      [],
      new Map(),
      new Map(),
    )

    expect(result.pinnedTopics.map((topic) => topic.id)).toEqual([1])
    expect(result.themeTree.map((node) => node.topic.id)).toEqual([1, 4])
    expect(result.themeTree[0].children.map((node) => node.topic.id)).toEqual([2, 3])
  })
})
