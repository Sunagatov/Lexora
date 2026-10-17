import {render, screen, within} from '@testing-library/react'
import {WordPagination} from '../components/WordPagination'

it.each([[1, 4], [2, 5], [4, 6]])('shows the single page gap for page %s of %s', (page, totalPages) => {
  const {container} = render(<WordPagination page={page} totalPages={totalPages} pageSize={50} onPage={vi.fn()} onPageSize={vi.fn()} />)
  const desktop = within(container.querySelector('.pagination-desktop') as HTMLElement)
  for (let value = 1; value <= totalPages; value++) expect(desktop.getByRole('button', {name: String(value)})).toBeTruthy()
  expect(screen.getByText(`Page ${page} of ${totalPages}`)).toBeTruthy()
})
