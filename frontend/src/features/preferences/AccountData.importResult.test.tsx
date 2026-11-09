import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import {MemoryRouter} from 'react-router-dom'
import {expect, it, vi} from 'vitest'
import {AccountData} from './AccountData'
import {WorkbookImportDialog} from '@/features/words/components/WorkbookImportDialog'
import * as api from '@/features/words/api/wordsApi'
import type {WorkbookPreview} from '@/features/words/types/wordTypes'

vi.mock('@/features/words/api/wordsApi', () => ({previewWordsWorkbook: vi.fn(), applyWordsWorkbook: vi.fn(),
  exportWordsWorkbook: vi.fn(), fetchWorkbookRecovery: vi.fn()}))
vi.mock('@/features/offline/offline', () => ({offlineStatus: () => online, subscribeOffline: () => () => {}}))
const online = {offline: false, pending: 0}

it.each([false, true])('keeps import confirmation and recovery download accessible (Account page: %s)', async account => {
  const file = new File(['test'], 'vocabulary.xlsx')
  const preview = {batch_id: '11111111-1111-1111-1111-111111111111', plan_hash: 'a'.repeat(64),
    summary: {rows: 1, created: 1, updated: 0, unchanged: 0, topics_created: 0}, errors: [], warnings: [], topics: [],
    entries: [{word_id: null, action: 'create', before: null, after: {term: 'receipt'}, locations: [{sheet: 'Words', row: 2}]}]} as WorkbookPreview
  vi.mocked(api.previewWordsWorkbook).mockResolvedValue(preview)
  vi.mocked(api.applyWordsWorkbook).mockReset().mockResolvedValue({...preview.summary, batch_id: preview.batch_id!,
    created_word_ids: [1], created_topic_ids: [], progress_preserved: true, replayed: false})
  const client = new QueryClient({defaultOptions: {queries: {retry: false}}})
  render(<QueryClientProvider client={client}><MemoryRouter>
    {account ? <AccountData /> : <WorkbookImportDialog file={file} onClose={vi.fn()} onApplied={async () => {}} />}
  </MemoryRouter></QueryClientProvider>)
  if (account) fireEvent.change(document.querySelector('input[type="file"]')!, {target: {files: [file]}})
  fireEvent.click(screen.getByRole('button', {name: 'Preview import'}))
  fireEvent.click(await screen.findByRole('button', {name: 'Apply import'}))
  await waitFor(() => expect(api.applyWordsWorkbook).toHaveBeenCalled())
  await screen.findByRole('button', {name: 'Download recovery record'})
})
