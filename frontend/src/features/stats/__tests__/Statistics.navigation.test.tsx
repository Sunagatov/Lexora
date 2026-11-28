import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {MemoryRouter, Outlet, Route, Routes} from 'react-router-dom'
import {expect, it, vi} from 'vitest'
import {AccountPage} from '@/features/preferences/AccountPage'
import type {LearningStatsResponse, LibraryStatsResponse} from '../types/statsTypes'

const request = vi.hoisted(() => vi.fn())
vi.mock('@/shared/api/http', async (importOriginal) => ({...await importOriginal<object>(), request}))
vi.mock('@/shared/hooks/useIsMobile', () => ({useIsMobile: () => true}))

it('opens each statistics view independently from My Lexora', async () => {
  const period = {attempts: 1, unique_words: 1, first_reviews: 1, repeat_reviews: 0,
    improved_words: 1, regressed_words: 0, study_days: 1}
  const learning: LearningStatsResponse = {
    as_of: '2026-11-28',
    review_periods: {'7': period, '30': period, '90': period, '365': period, all: period, previous_week: period},
    level_counts: {level_1: 1, level_2: 0, level_3: 1, level_4: 1, level_5: 1, unset: 1},
    okay_or_better_pct: 67,
    review_history: {reviewed_words: 1, improved_words: 1, regressed_words: 0},
    usage_summary: {total_active_seconds: 25, active_days: 1, sessions: 1, avg_session_seconds: 25,
      longest_session_seconds: 25, today_active_seconds: 25, last_7d_active_seconds: 25},
    consistency_summary: {active_streak_days: 1, study_streak_days: 1, longest_active_streak_days: 1,
      longest_study_streak_days: 1, active_days_last_30d: 1, study_days_last_30d: 1,
      active_days_last_90d: 1, study_days_last_90d: 1},
    mix_activity: {started: 0, completed: 0, in_progress: 0, unfinished: 0, completion_rate_pct: null, avg_completion_span_seconds: null},
    usage_daily: [], topics: [], daily_activity: [], tracking_started_at: null, usage_started_at: null,
  }
  const library: LibraryStatsResponse = {
    readiness: {translation_language: 'ru', ready: 0, missing_translation: 5, no_examples: 3,
      needs_examples: 4, no_topic: 2, multiple_topics: 1},
    overview: {total_words: 5, total_topics: 1, with_example: 2, with_examples_3plus: 1, with_pos: 4,
      missing_example: 3, needs_example_enrichment: 4, missing_pos: 1, needs_enrichment: 4},
    vocab_profile: {cefr_distribution: {}, register_distribution: {}, pos_distribution: {}},
    enrichment_coverage: {total_words: 5, with_definition: 0, with_ipa: 0, with_translation: 0,
      with_examples: 2, with_synonyms: 0, with_antonyms: 0, with_collocations: 0, with_confusables: 0,
      with_cefr: 0, with_register: 0},
    topics: [], words_added_by_month: {}, study_coverage: {reviewed_words: 1, never_reviewed_words: 4, reviewed_word_share_pct: 20},
  }
  request.mockImplementation(async (path: string) => {
    if (path === '/api/stats/learning') return learning
    if (path === '/api/stats/library') return library
    if (path === '/api/stats/learning/revisit?group=weak&page=1') return {entries: [{id: 3, term: 'review me', knowledge_level: 1}], total: 1, has_more: false}
    if (path === '/api/stats/library/entries?gap=translation&page=1') return {entries: [{id: 5, term: 'translate me', knowledge_level: null}], total: 5, has_more: false}
    if (path === '/api/words/3') return {id: 3, knowledge_level: 3}
    throw new Error(`Unexpected request ${path}`)
  })
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account']}>
        <Routes>
          <Route element={<Outlet context={{drawerOpen: false, setDrawerOpen: vi.fn()}} />}>
            <Route path="/account/:section?" element={<AccountPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  expect(request).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('link', {name: /Learning Statistics\s*Knowledge/}))
  expect(await screen.findByText('Current knowledge')).toBeTruthy()
  expect(screen.getByText('Unrated')).toBeTruthy()
  expect(screen.getByText('Review history')).toBeTruthy()
  expect(screen.queryByText('Total words')).toBeNull()
  expect(request.mock.calls.map(([path]) => path)).toEqual(['/api/stats/learning'])

  fireEvent.click(screen.getByRole('button', {name: 'Weak'}))
  expect((await screen.findByRole('link', {name: 'review me'})).getAttribute('href')).toBe('/words/3')
  fireEvent.click(screen.getByRole('button', {name: 'My Lexora'}))
  fireEvent.click(screen.getByRole('link', {name: /Library Statistics\s*Word counts/}))
  expect(await screen.findByText('Total words')).toBeTruthy()
  expect(screen.getByText('Study coverage')).toBeTruthy()
  expect(screen.queryByText('Current knowledge')).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: 'Missing translation (5)'}))
  expect((await screen.findByRole('link', {name: 'translate me'})).getAttribute('href')).toBe('/words/5')
  expect(request.mock.calls.map(([path]) => path)).toEqual([
    '/api/stats/learning', '/api/stats/learning/revisit?group=weak&page=1', '/api/stats/library', '/api/stats/library/entries?gap=translation&page=1',
  ])

  fireEvent.click(screen.getByRole('button', {name: 'My Lexora'}))
  fireEvent.click(screen.getByRole('link', {name: /Learning Statistics\s*Knowledge/}))
  fireEvent.click(await screen.findByRole('button', {name: 'Weak'}))
  fireEvent.click(await screen.findByRole('button', {name: 'Rate review me'}))
  fireEvent.click(within(screen.getByRole('dialog', {name: 'Knowledge level'})).getByRole('button', {name: 'Okay'}))
  await waitFor(() => expect(request).toHaveBeenCalledWith('/api/words/3',
    expect.objectContaining({body: expect.stringMatching(/"progress_source":"study_list"/)})))
})
