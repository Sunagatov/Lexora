import {render, screen, fireEvent} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter} from 'react-router-dom'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'

import {TopicSidebar} from '../TopicSidebar'
import type {Topic} from '../../../shared/types'

function makeStorage() {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(key, value)
    },
    removeItem(key: string) {
      store.delete(key)
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
  } as Storage
}

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

function renderSidebar(topics: Topic[], selectedTopicId: number | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TopicSidebar
          topics={topics}
          topicCounts={new Map()}
          topicProgress={new Map()}
          totalWords={0}
          topicSearch=""
          setTopicSearch={() => {}}
          selectedTopicId={selectedTopicId}
          isSmartReview={false}
          onSelect={() => {}}
          onSelectSmartReview={() => {}}
          smartQueue={null}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('TopicSidebar disclosure navigation', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', makeStorage())
    localStorage.clear()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps subtopics hidden until the parent topic is expanded', () => {
    renderSidebar([
      makeTopic(1, 'Animals'),
      makeTopic(2, 'Pets', 1),
    ])

    expect(screen.queryByRole('button', {name: /^Pets\b/})).toBeNull()

    fireEvent.click(screen.getByRole('button', {name: 'Expand Animals'}))

    expect(screen.getByRole('button', {name: /^Pets\b/})).not.toBeNull()
  })

  it('auto-expands the branch for the selected subtopic', () => {
    renderSidebar([
      makeTopic(1, 'Animals'),
      makeTopic(2, 'Pets', 1),
    ], 2)

    expect(screen.getByRole('button', {name: /^Pets\b/})).not.toBeNull()
    expect(screen.getByRole('button', {name: 'Collapse Animals'}).getAttribute('aria-expanded')).toBe('true')
  })

  it('allows collapsing an auto-expanded active branch', () => {
    renderSidebar([
      makeTopic(1, 'Animals'),
      makeTopic(2, 'Pets', 1),
    ], 2)

    fireEvent.click(screen.getByRole('button', {name: 'Collapse Animals'}))

    expect(screen.queryByRole('button', {name: /^Pets\b/})).toBeNull()
    expect(screen.getByRole('button', {name: 'Expand Animals'}).getAttribute('aria-expanded')).toBe('false')
  })
})
