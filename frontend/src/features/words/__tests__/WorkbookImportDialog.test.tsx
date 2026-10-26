import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {beforeEach, describe, expect, it, vi} from 'vitest'
import {ApiError} from '@/shared/api/apiError'
import {WorkbookImportDialog} from '@/features/words/components/WorkbookImportDialog'
import type {WorkbookPreview} from '@/features/words/types/wordTypes'
import * as api from '@/features/words/api/wordsApi'

vi.mock('@/features/words/api/wordsApi', () => ({
  previewWordsWorkbook: vi.fn(),
  applyWordsWorkbook: vi.fn(),
  exportWordsWorkbook: vi.fn(),
  fetchWorkbookRecovery: vi.fn(),
}))
vi.mock('@/features/auth/lib/redirectIfUnauthorized', () => ({redirectIfUnauthorized: vi.fn()}))

const plan: WorkbookPreview = {
  batch_id: '11111111-1111-1111-1111-111111111111',
  plan_hash: 'a'.repeat(64),
  summary: {rows: 1, created: 1, updated: 0, unchanged: 0, topics_created: 0},
  errors: [],
  warnings: [],
  topics: [],
  entries: [
    {
      word_id: null,
      action: 'create',
      before: null,
      after: {term: 'receipt', translations: ['чек']},
      locations: [{sheet: 'Words', row: 2}],
    },
  ],
}
const completed = {
  ...plan.summary,
  batch_id: plan.batch_id!,
  created_word_ids: [4],
  created_topic_ids: [],
  progress_preserved: true,
  replayed: false,
}

function setup(onApplied = vi.fn().mockResolvedValue(undefined)) {
  const file = new File(['test'], 'vocabulary.xlsx')
  const onClose = vi.fn()
  render(<WorkbookImportDialog file={file} onClose={onClose} onApplied={onApplied} />)
  return {file, onClose, onApplied}
}

describe('Workbook import review', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(api.previewWordsWorkbook).mockResolvedValue(plan)
    vi.mocked(api.applyWordsWorkbook).mockResolvedValue(completed)
  })

  it('never imports automatically and requires a reviewed preview', async () => {
    const {file} = setup()
    expect(api.previewWordsWorkbook).not.toHaveBeenCalled()
    expect(api.applyWordsWorkbook).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', {name: 'Preview import'}))
    await screen.findByRole('region', {name: 'Import preview'})
    expect(api.previewWordsWorkbook).toHaveBeenCalledWith(file, 'add', 4, expect.any(AbortSignal))
    fireEvent.click(screen.getByRole('button', {name: 'Apply import'}))
    await screen.findByRole('heading', {name: 'Import complete'})
    expect(api.applyWordsWorkbook).toHaveBeenCalledWith(plan)
  })

  it('blocks apply for all row errors and clears a preview when options change', async () => {
    vi.mocked(api.previewWordsWorkbook).mockResolvedValueOnce({
      ...plan,
      batch_id: null,
      errors: [{sheet: 'Words', row: 3, message: 'Missing word'}],
    })
    setup()
    fireEvent.click(screen.getByRole('button', {name: 'Preview import'}))
    await screen.findByText('Errors — fix these before applying (1)')
    expect((screen.getByRole('button', {name: 'Apply import'}) as HTMLButtonElement).disabled).toBe(
      true,
    )
    fireEvent.change(screen.getByLabelText('Import mode'), {target: {value: 'content'}})
    expect(screen.queryByRole('region', {name: 'Import preview'})).toBeNull()
    expect(api.applyWordsWorkbook).not.toHaveBeenCalled()
  })

  it('requires warning acknowledgement and retries a lost response with the same batch', async () => {
    const warned = {
      ...plan,
      warnings: [{sheet: 'Words', row: 2, message: 'Fewer than four translations'}],
    }
    vi.mocked(api.previewWordsWorkbook).mockResolvedValueOnce(warned)
    vi.mocked(api.applyWordsWorkbook)
      .mockRejectedValueOnce(new Error('Connection lost'))
      .mockResolvedValueOnce({...completed, replayed: true})
    const onApplied = vi.fn().mockRejectedValue(new Error('Refresh failed'))
    setup(onApplied)
    fireEvent.click(screen.getByRole('button', {name: 'Preview import'}))
    const apply = await screen.findByRole('button', {name: 'Apply import'})
    expect((apply as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByLabelText('I reviewed the quality warnings'))
    fireEvent.click(apply)
    expect((await screen.findByRole('alert')).textContent).toContain('Connection lost')
    fireEvent.click(apply)
    await screen.findByRole('heading', {name: 'Import complete'})
    expect(api.applyWordsWorkbook).toHaveBeenNthCalledWith(1, warned)
    expect(api.applyWordsWorkbook).toHaveBeenNthCalledWith(2, warned)
    expect(onApplied).toHaveBeenCalledOnce()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('requires a fresh preview after concurrent vocabulary edits', async () => {
    vi.mocked(api.applyWordsWorkbook).mockRejectedValueOnce(
      new ApiError(409, 'Vocabulary changed after preview'),
    )
    setup()
    fireEvent.click(screen.getByRole('button', {name: 'Preview import'}))
    fireEvent.click(await screen.findByRole('button', {name: 'Apply import'}))
    await waitFor(() => expect(screen.queryByRole('region', {name: 'Import preview'})).toBeNull())
    expect((await screen.findByRole('alert')).textContent).toContain('Vocabulary changed')
  })
})
