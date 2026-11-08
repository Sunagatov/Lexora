import {fireEvent, render, screen} from '@testing-library/react'
import {MemoryRouter} from 'react-router-dom'
import {beforeEach, expect, it, vi} from 'vitest'
import {StatsPage} from '../routes/StatsPage'

const retry = vi.hoisted(() => vi.fn())
vi.mock('../hooks/useStatsPageState', () => ({
  useStatsPageState: () => ({isLoading: false, stats: undefined, retry}),
}))
beforeEach(() => retry.mockClear())

it('lets account users retry a failed Statistics load without leaving the account', () => {
  render(<MemoryRouter><StatsPage embedded /></MemoryRouter>)
  expect(screen.getByText('Statistics unavailable')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}))
  expect(retry).toHaveBeenCalledOnce()
  expect(screen.queryByRole('button', {name: 'Back Home'})).toBeNull()
})
