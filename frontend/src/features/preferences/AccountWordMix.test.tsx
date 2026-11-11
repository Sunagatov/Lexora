import {fireEvent, render, screen} from '@testing-library/react'
import {beforeEach, expect, it, vi} from 'vitest'
import {AccountWordMix} from './AccountWordMix'
import {DEFAULT_PREFERENCES, updatePreferences} from './api'

vi.mock('./api', async () => ({...await vi.importActual('./api'), updatePreferences: vi.fn()}))
const defaults = {...DEFAULT_PREFERENCES.word_mix, levels: [1, 3] as (1 | 3 | 4 | 5)[]}
beforeEach(() => vi.clearAllMocks())

it('keeps the existing Swipe preference and saves List without changing the word mix', () => {
  localStorage.setItem('lexora-word-mix-view', 'swipe')
  const {unmount} = render(<AccountWordMix preferences={defaults} />)
  expect(screen.getByRole('button', {name: 'Swipe'}).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', {name: 'List'}))
  expect(screen.getByRole('button', {name: 'List'}).getAttribute('aria-pressed')).toBe('true')
  expect(updatePreferences).not.toHaveBeenCalled()
  unmount()
  render(<AccountWordMix preferences={defaults} />)
  expect(screen.getByRole('button', {name: 'List'}).getAttribute('aria-pressed')).toBe('true')
})

it('defaults to List and restores Swipe when account settings reopen', () => {
  const {unmount} = render(<AccountWordMix preferences={defaults} />)
  expect(screen.getByRole('button', {name: 'List'}).getAttribute('aria-pressed')).toBe('true')
  fireEvent.click(screen.getByRole('button', {name: 'Swipe'}))
  unmount()
  render(<AccountWordMix preferences={defaults} />)
  expect(screen.getByRole('button', {name: 'Swipe'}).getAttribute('aria-pressed')).toBe('true')
  expect(updatePreferences).not.toHaveBeenCalled()
})

it('changes the set size without resetting the other mix settings', () => {
  render(<AccountWordMix preferences={defaults} />)
  fireEvent.click(screen.getByRole('button', {name: '100'}))
  expect(updatePreferences).toHaveBeenCalledWith({word_mix: {size: 100}})
})

it('rejects invalid custom sizes locally and allows a valid whole number', () => {
  render(<AccountWordMix preferences={defaults} />)
  const input = screen.getByRole('spinbutton', {name: 'Custom word mix size'})
  fireEvent.change(input, {target: {value: '1.5'}})
  fireEvent.blur(input)
  expect(screen.getByRole('alert').textContent).toContain('whole number')
  expect(updatePreferences).not.toHaveBeenCalled()
  fireEvent.change(input, {target: {value: '75'}})
  fireEvent.blur(input)
  expect(updatePreferences).toHaveBeenCalledWith({word_mix: {size: 75}})
})

it('combines knowledge and CEFR choices while always keeping one knowledge level', () => {
  const {rerender} = render(<AccountWordMix preferences={defaults} />)
  fireEvent.click(screen.getByRole('button', {name: 'Strong'}))
  expect(updatePreferences).toHaveBeenLastCalledWith({word_mix: {levels: [1, 3, 4]}})
  rerender(<AccountWordMix preferences={{...defaults, levels: [1]}} />)
  expect(screen.getByRole('button', {name: 'Weak'}).hasAttribute('disabled')).toBe(true)
  fireEvent.click(screen.getByRole('button', {name: 'A1'}))
  expect(updatePreferences).toHaveBeenLastCalledWith({word_mix: {cefr_levels: ['A1']}})
})

it('saves variety controls and shows all topics without a misleading topic selector', () => {
  render(<AccountWordMix preferences={defaults} />)
  fireEvent.change(screen.getByRole('combobox', {name: 'Avoid recent repeats'}), {target: {value: '7'}})
  expect(updatePreferences).toHaveBeenLastCalledWith({word_mix: {cooldown_days: 7}})
  fireEvent.click(screen.getByRole('checkbox', {name: 'Balance across topics'}))
  expect(updatePreferences).toHaveBeenLastCalledWith({word_mix: {balance_topics: false}})
  expect(screen.getByText('All topics')).toBeTruthy()
  expect(screen.queryByRole('combobox', {name: 'Topics'})).toBeNull()
})

it('keeps an unfinished custom size when synced preferences refresh', () => {
  const {rerender} = render(<AccountWordMix preferences={defaults} />)
  const input = screen.getByRole('spinbutton', {name: 'Custom word mix size'}) as HTMLInputElement
  fireEvent.change(input, {target: {value: '75'}})
  rerender(<AccountWordMix preferences={{...defaults, size: 500}} />)
  expect(input.value).toBe('75')
  fireEvent.blur(input)
  expect(updatePreferences).toHaveBeenLastCalledWith({word_mix: {size: 75}})
})

it('lets Escape discard a draft and use the latest synced size', () => {
  const {rerender} = render(<AccountWordMix preferences={defaults} />)
  const input = screen.getByRole('spinbutton', {name: 'Custom word mix size'}) as HTMLInputElement
  fireEvent.change(input, {target: {value: '75'}})
  rerender(<AccountWordMix preferences={{...defaults, size: 500}} />)
  fireEvent.keyDown(input, {key: 'Escape'})
  expect(input.value).toBe('500')
  fireEvent.blur(input)
  expect(updatePreferences).not.toHaveBeenCalled()
})
