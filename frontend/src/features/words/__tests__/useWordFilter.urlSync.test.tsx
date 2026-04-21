import {render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, useLocation} from 'react-router-dom'
import {describe, expect, it} from 'vitest'
import {useWordFilter} from '../useWordFilter'
import type {Word} from '../../../shared/types'

function Probe() {
  useWordFilter([] as Word[])
  const location = useLocation()
  return <div data-testid="search" data-search={location.search}>{location.search}</div>
}

describe('useWordFilter URL sync', () => {
  it('clamps an out-of-range page param back into the URL', async () => {
    render(
      <MemoryRouter initialEntries={[{pathname: '/', search: '?page=5'}]}>
        <Probe />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('search').getAttribute('data-search')).toBe('')
    })
  })
})
