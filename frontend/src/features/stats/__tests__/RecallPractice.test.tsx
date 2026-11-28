import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {expect, it, vi} from 'vitest'
import {RecallPractice} from '../components/RecallPractice'
import type {Word} from '@/features/words/types/wordTypes'

const words = [
  {id: 12, language: 'en', term: 'train', translation_language: 'ru', translation_entries: ['поезд']},
  {id: 17, language: 'en', term: 'platform', translation_language: 'ru', translation_entries: ['перрон']},
] as Word[]

it('reveals each answer separately and records the self-rated outcomes', async () => {
  const recordOutcome = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn()
  render(<RecallPractice words={words} onClose={onClose} recordOutcome={recordOutcome} />)

  expect(screen.getByRole('heading', {name: 'train'})).toBeTruthy()
  expect(screen.queryByText('поезд')).toBeNull()
  expect(screen.queryByRole('button', {name: 'Recalled'})).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: 'Reveal answer'}))
  expect(screen.getByText('поезд')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', {name: 'Recalled'}))
  await screen.findByRole('heading', {name: 'platform'})
  expect(screen.queryByText('перрон')).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: 'Reveal answer'}))
  fireEvent.click(screen.getByRole('button', {name: 'Missed'}))

  expect(await screen.findByText('1 of 2 recalled')).toBeTruthy()
  expect(recordOutcome.mock.calls.map(([id, recalled, timestamp]) => [id, recalled, Number.isFinite(Date.parse(timestamp))]))
    .toEqual([[12, true, true], [17, false, true]])
  fireEvent.click(screen.getByRole('button', {name: 'Done'}))
  expect(onClose).toHaveBeenCalledOnce()
})

it('sends the same timestamp and outcome after a save failure and ignores duplicate clicks', async () => {
  let finish = () => {}
  const pending = new Promise<void>(resolve => { finish = resolve })
  const recordOutcome = vi.fn().mockRejectedValueOnce(new Error('Could not save')).mockReturnValueOnce(pending)
  render(<RecallPractice words={words.slice(0, 1)} onClose={vi.fn()} recordOutcome={recordOutcome} />)

  fireEvent.click(screen.getByRole('button', {name: 'Reveal answer'}))
  fireEvent.click(screen.getByRole('button', {name: 'Missed'}))
  await screen.findByRole('alert')
  const retry = screen.getByRole('button', {name: 'Retry'})
  fireEvent.click(retry)
  fireEvent.click(retry)
  expect(recordOutcome).toHaveBeenCalledTimes(2)
  expect(recordOutcome.mock.calls[1]).toEqual(recordOutcome.mock.calls[0])
  expect(screen.queryByText('0 of 1 recalled')).toBeNull()
  await act(async () => finish())
  await waitFor(() => expect(screen.getByText('0 of 1 recalled')).toBeTruthy())
})

it('sets up at most ten answerable words', () => {
  const word = words[0]
  const practiceWords = [
    {...word, id: 100, term: 'without a translation', translation_entries: []},
    ...Array.from({length: 11}, (_, index) => ({...word, id: index + 1})),
  ]
  render(<RecallPractice words={practiceWords} onClose={vi.fn()} recordOutcome={vi.fn()} />)

  expect(screen.getByRole('status').textContent).toBe('Word 1 of 10')
  expect(screen.getByRole('heading', {name: 'train'})).toBeTruthy()
})
