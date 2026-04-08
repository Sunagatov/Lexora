import {PAGE_SIZES} from '../words/useWordFilter'
import {CompactDropdown} from '../../shared/CompactDropdown'

type Props = {page: number; totalPages: number; onPage: (p: number) => void; pageSize: number; onPageSize: (n: number) => void}

const PAGE_SIZE_OPTIONS = PAGE_SIZES.map((s) => ({value: String(s), label: `${s} / page`}))

export function Pagination({page, totalPages, onPage, pageSize, onPageSize}: Props) {
  const sizeDropdown = (
    <CompactDropdown value={String(pageSize)} options={PAGE_SIZE_OPTIONS} onChange={(v) => onPageSize(Number(v))} ariaLabel="Words per page" className="page-size-dropdown" />
  )

  if (totalPages <= 1) return (
    <div className="pagination-shell">
      <div className="pagination pagination-desktop">{sizeDropdown}</div>
      <div className="pagination pagination-mobile">{sizeDropdown}</div>
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
        <button className="page-btn page-nav" disabled={page === 1} onClick={() => onPage(page - 1)}>← Prev</button>
        {tokens.map((t, i) => t === '…'
          ? <span key={`e${i}`} className="page-ellipsis">…</span>
          : <button key={t} className={`page-btn ${t === page ? 'page-btn-active' : ''}`} onClick={() => onPage(t)}>{t}</button>
        )}
        <button className="page-btn page-nav" disabled={page === totalPages} onClick={() => onPage(page + 1)}>Next →</button>
        {sizeDropdown}
      </div>
      <div className="pagination pagination-mobile">
        <button className="page-btn page-nav-mobile" disabled={page === 1} onClick={() => onPage(page - 1)}>←</button>
        <span className="page-label">Page {page} of {totalPages}</span>
        <button className="page-btn page-nav-mobile" disabled={page === totalPages} onClick={() => onPage(page + 1)}>→</button>
        {sizeDropdown}
      </div>
    </div>
  )
}
