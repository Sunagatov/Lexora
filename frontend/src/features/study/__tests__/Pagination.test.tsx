import {render, screen} from '@testing-library/react'
import {describe, expect, it, vi} from 'vitest'
import {WordPagination} from '@/features/words/components/WordPagination'

describe('Pagination', () => {
  it('keeps desktop and mobile navigation visible but disabled when only one page is available', () => {
    render(
      <WordPagination
        page={1}
        totalPages={1}
        pageSize={20}
        onPage={vi.fn()}
        onPageSize={vi.fn()}
      />,
    )

    expect((screen.getByRole('button', {name: '← Prev'}) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', {name: 'Next →'}) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', {name: '1'}) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', {name: '←'}) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', {name: '→'}) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Page 1 of 1')).not.toBeNull()
  })
})
