import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach, expect, it, vi} from 'vitest'
import {request} from '@/shared/api/http'
import {exportWordsWorkbook} from '@/features/words/api/wordsApi'
import type {Topic} from '@/features/topics/types/topicTypes'
import {DEFAULT_PREFERENCES} from './api'
import {AccountData} from './AccountData'

vi.mock('@/shared/api/http', () => ({request: vi.fn()}))
vi.mock('@/features/words/api/wordsApi', () => ({exportWordsWorkbook: vi.fn()}))
vi.mock('@/features/words/components/WorkbookImportDialog', () => ({WorkbookImportDialog: () => null}))
vi.mock('@/features/offline/offline', () => ({
  offlineStatus: () => online,
  subscribeOffline: () => () => {},
}))
vi.mock('./api', async () => ({...await vi.importActual('./api'), usePreferences: () => DEFAULT_PREFERENCES}))
const online = {offline: false, pending: 0}
const topics = [
  {id: 1, name: 'Work', parent_topic_id: null},
  {id: 2, name: 'Basics', parent_topic_id: 1},
  {id: 3, name: 'Travel', parent_topic_id: null},
  {id: 4, name: 'Basics', parent_topic_id: 3},
] as Topic[]

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(request).mockResolvedValue(topics)
  vi.mocked(exportWordsWorkbook).mockResolvedValue(undefined)
})

function setup() {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  render(<QueryClientProvider client={client}><MemoryRouter><AccountData /></MemoryRouter></QueryClientProvider>)
  return client
}

it('distinguishes identically named export topics by their parent paths', async () => {
  setup()
  fireEvent.change(screen.getByRole('combobox', {name: 'Words to export'}), {target: {value: 'topics'}})
  expect(await screen.findByRole('checkbox', {name: 'Work / Basics'})).toBeTruthy()
  expect(screen.getByRole('checkbox', {name: 'Travel / Basics'})).toBeTruthy()
})

it('does not export a topic that disappeared during a background refresh', async () => {
  const client = setup()
  fireEvent.change(screen.getByRole('combobox', {name: 'Words to export'}), {target: {value: 'topics'}})
  const boxes = await screen.findAllByRole('checkbox', {name: /Basics/})
  fireEvent.click(boxes[0])
  expect((screen.getByRole('button', {name: 'Export Excel'}) as HTMLButtonElement).disabled).toBe(false)
  act(() => client.setQueryData(['export-topics', ['en']], topics.filter(topic => topic.id !== 2)))
  await waitFor(() => expect((screen.getByRole('button', {name: 'Export Excel'}) as HTMLButtonElement).disabled).toBe(true))
  fireEvent.click(screen.getByRole('button', {name: 'Export Excel'}))
  expect(exportWordsWorkbook).not.toHaveBeenCalled()
})

it('exports only still-visible selected topics after a refresh', async () => {
  const client = setup()
  fireEvent.change(screen.getByRole('combobox', {name: 'Words to export'}), {target: {value: 'topics'}})
  const boxes = await screen.findAllByRole('checkbox', {name: /Basics/})
  boxes.forEach(box => fireEvent.click(box))
  act(() => client.setQueryData(['export-topics', ['en']], topics.filter(topic => topic.id !== 2)))
  await waitFor(() => expect(screen.queryByRole('checkbox', {name: 'Work / Basics'})).toBeNull())
  fireEvent.click(screen.getByRole('button', {name: 'Export Excel'}))
  await waitFor(() => expect(exportWordsWorkbook).toHaveBeenCalledWith(false, {
    languages: ['en'], favoritesOnly: false, topicIds: [4],
  }))
})
