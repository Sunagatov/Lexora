import {PAGE_SIZES} from '../../shared/paginationConfig'

type Props = {page: number; totalPages: number; onPage: (p: number) => void; pageSize: number; onPageSize: (n: number) => void}

export function Pagination({page, totalPages, onPage, pageSize, onPageSize}: Props) {
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

  if (totalPages <= 1) return (
    <div className="pagination-shell">
      <div className="pagination pagination-desktop">{sizeSelect}</div>
      <div className="pagination pagination-mobile">{sizeSelect}</div>
    </div>
  )

  const tokens: (number | '…')[] = []
  const add = (n: number) => { if (!tokens.includes(n)) tokens.push(n) }
  add(1)
  if (page - 2 > 2) tokens.push('…')
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) add(i)
  if (page + 2 < totalPages - 1) tokens.push('…')
  if (totalPages > 1) add(totalPages)

  return (
    <div className="pagination-shell">
      <div className="pagination pagination-desktop">
        <button type="button" className="page-btn page-nav" disabled={page === 1} onClick={() => onPage(page - 1)}>← Prev</button>
        {tokens.map((t, i) => t === '…'
          ? <span key={`e${i}`} className="page-ellipsis">…</span>
          : <button type="button" key={t} className={`page-btn ${t === page ? 'page-btn-active' : ''}`} onClick={() => onPage(t)}>{t}</button>
        )}
        <button type="button" className="page-btn page-nav" disabled={page === totalPages} onClick={() => onPage(page + 1)}>Next →</button>
        {sizeSelect}
      </div>
      <div className="pagination pagination-mobile">
        <button type="button" className="page-btn page-nav-mobile" disabled={page === 1} onClick={() => onPage(page - 1)}>←</button>
        <span className="page-label">Page {page} of {totalPages}</span>
        <button type="button" className="page-btn page-nav-mobile" disabled={page === totalPages} onClick={() => onPage(page + 1)}>→</button>
        {sizeSelect}
      </div>
    </div>
  )
}
