import {PAGE_SIZES} from '@/shared/config/pagination'

type Props = {page: number; totalPages: number; onPage: (p: number) => void; pageSize: number; onPageSize: (n: number) => void}

export function Pagination({page, totalPages, onPage, pageSize, onPageSize}: Props) {
  const safeTotalPages = Math.max(totalPages, 1)
  const safePage = Math.min(Math.max(page, 1), safeTotalPages)
  const isStaticPagination = safeTotalPages <= 1

  const sizeSelect = (
    <select
      className="page-size-dropdown"
      value={String(pageSize)}
      onChange={(e) => onPageSize(Number(e.target.value))}
      aria-label="Words per page"
    >
      {PAGE_SIZES.map((s) => <option key={s} value={String(s)}>{s} / page</option>)}
    </select>
  )

  const tokens: (number | '…')[] = []
  const add = (n: number) => { if (!tokens.includes(n)) tokens.push(n) }
  add(1)
  if (safePage - 2 > 2) tokens.push('…')
  for (let i = Math.max(2, safePage - 1); i <= Math.min(safeTotalPages - 1, safePage + 1); i++) add(i)
  if (safePage + 2 < safeTotalPages - 1) tokens.push('…')
  if (safeTotalPages > 1) add(safeTotalPages)

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
          disabled={isStaticPagination || safePage === 1}
          onClick={() => onPage(safePage - 1)}
        >
          ←
        </button>
        <span className="page-label">Page {safePage} of {safeTotalPages}</span>
        <button
          type="button"
          className="page-btn page-nav-mobile"
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
