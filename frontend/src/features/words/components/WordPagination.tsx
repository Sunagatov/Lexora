import {PAGE_SIZES} from '@/shared/config/pagination'

type Props = {page: number; totalPages: number; onPage: (p: number) => void; pageSize: number; onPageSize: (n: number) => void}

export function WordPagination({page, totalPages, onPage, pageSize, onPageSize}: Props) {
  const safeTotalPages = Math.max(totalPages, 1)
  const safePage = Math.min(Math.max(page, 1), safeTotalPages)
  const isStaticPagination = safeTotalPages <= 1

  const sizeSelect = (
    <label className="dropdown-trigger word-list-control page-size-picker">
      <span className="dropdown-trigger-label" aria-hidden="true">{pageSize} / page</span>
      <span className="dropdown-trigger-icon" aria-hidden="true">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4.5 6 7.5l3-3" />
        </svg>
      </span>
      <select
        className="page-size-dropdown"
        value={String(pageSize)}
        onChange={(e) => onPageSize(Number(e.target.value))}
        aria-label="Words per page"
      >
        {PAGE_SIZES.map((s) => <option key={s} value={String(s)}>{s} / page</option>)}
      </select>
    </label>
  )

  const tokens: (number | '…')[] = []
  const pages = [...new Set([1, safePage - 1, safePage, safePage + 1, safeTotalPages])]
    .filter(value => value >= 1 && value <= safeTotalPages).sort((a, b) => a - b)
  pages.forEach((value, index) => {
    const previous = pages[index - 1]
    if (previous !== undefined && value - previous === 2) tokens.push(previous + 1)
    else if (previous !== undefined && value - previous > 2) tokens.push('…')
    tokens.push(value)
  })

  return (
    <div className="pagination-shell">
      <div className="pagination pagination-desktop">
        <button
          type="button"
          className="page-btn page-nav"
          disabled={isStaticPagination || safePage === 1}
          onClick={() => onPage(safePage - 1)}
        >
          ← Prev
        </button>
        {tokens.map((t, i) => t === '…'
          ? <span key={`e${i}`} className="page-ellipsis">…</span>
          : (
            <button
              type="button"
              key={t}
              className={`page-btn ${t === safePage ? 'page-btn-active' : ''}`}
              aria-current={t === safePage ? 'page' : undefined}
              disabled={isStaticPagination}
              onClick={() => onPage(t)}
            >
              {t}
            </button>
          )
        )}
        <button
          type="button"
          className="page-btn page-nav"
          disabled={isStaticPagination || safePage === safeTotalPages}
          onClick={() => onPage(safePage + 1)}
        >
          Next →
        </button>
        {sizeSelect}
      </div>
      <div className="pagination pagination-mobile">
        <button
          type="button"
          className="page-btn page-nav-mobile"
          aria-label="Previous page"
          disabled={isStaticPagination || safePage === 1}
          onClick={() => onPage(safePage - 1)}
        >
          ←
        </button>
        <span className="page-label">Page {safePage} of {safeTotalPages}</span>
        <button
          type="button"
          className="page-btn page-nav-mobile"
          aria-label="Next page"
          disabled={isStaticPagination || safePage === safeTotalPages}
          onClick={() => onPage(safePage + 1)}
        >
          →
        </button>
        {sizeSelect}
      </div>
    </div>
  )
}
