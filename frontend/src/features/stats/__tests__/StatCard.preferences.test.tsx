import {render, screen} from '@testing-library/react'
import {beforeEach, expect, it, vi} from 'vitest'
import {StatCard} from '../components/StatsComponents'

const preferences = vi.hoisted(() => ({animations: false}))
vi.mock('@/features/preferences/api', () => ({usePreferences: () => preferences}))
beforeEach(() => { preferences.animations = false })

it('shows the final statistic immediately when account animations are disabled', () => {
  const frame = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1)
  render(<StatCard label="Total words" value={130} />)
  expect(screen.getByText('130')).toBeTruthy()
  expect(frame).not.toHaveBeenCalled()
})

it('shows the final statistic immediately when account animations are enabled', () => {
  preferences.animations = true
  const frame = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(123)
  const {rerender} = render(<StatCard label="Total words" value={130} />)
  expect(screen.getByText('130')).toBeTruthy()
  rerender(<StatCard label="Total words" value={131} />)
  expect(screen.getByText('131')).toBeTruthy()
  expect(frame).not.toHaveBeenCalled()
})
