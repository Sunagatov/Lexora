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

it('stops an active counter when animations are switched off', () => {
  preferences.animations = true
  vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(123)
  const cancel = vi.spyOn(window, 'cancelAnimationFrame')
  const {rerender} = render(<StatCard label="Total words" value={130} />)
  preferences.animations = false
  rerender(<StatCard label="Total words" value={130} />)
  expect(screen.getByText('130')).toBeTruthy()
  expect(cancel).toHaveBeenCalledWith(123)
})
