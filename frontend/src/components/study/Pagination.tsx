type Props = {
  page: number
  totalPages: number
  onPage: (p: number) => void
}

export function Pagination({page, totalPages, onPage}: Props) {
  if (totalPages <= 1) return null

  // Build page tokens: always show first, last, current ±1, ellipsis in gaps
  const tokens: (number | '…')[] = []
  const add = (n: number) => { if (!tokens.includes(n)) tokens.push(n) }

  add(1)
  if (page - 2 > 2) tokens.push('…')
  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) add(i)
  if (page + 2 < totalPages - 1) tokens.push('…')
  if (totalPages > 1) add(totalPages)

  return (
    <div className="pagination">
      <button className="page-btn page-nav" disabled={page === 1} onClick={() => onPage(page - 1)}>
        ← Prev
      </button>

      {tokens.map((t, i) =>
        t === '…' ? (
          <span key={`e${i}`} className="page-ellipsis">…</span>
        ) : (
          <button
            key={t}
            className={`page-btn ${t === page ? 'page-btn-active' : ''}`}
            onClick={() => onPage(t)}
          >
            {t}
          </button>
        ),
      )}

      <button className="page-btn page-nav" disabled={page === totalPages} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </div>
  )
}
