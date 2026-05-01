function WordTableSkeleton() {
  return (
    <div className="sk-rows">
      {Array.from({length: 8}, (_, i) => (
        <div key={i} className="sk-row">
          <div className="sk" style={{height: 14}} />
          <div className="sk" style={{height: 13, width: '65%'}} />
          <div className="sk" style={{height: 24, borderRadius: 20}} />
        </div>
      ))}
    </div>
  )
}

import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import type {SortOption} from '@/features/words/model/wordDomain'
import {WordCollectionToolbar} from '@/features/words/components/WordCollectionToolbar'
import {WordPagination} from '@/features/words/components/WordPagination'
import {WordTable} from '@/features/words/components/WordTable'
import {WordCardList} from '@/features/words/components/WordCardList'

type Props = {
  // filter state
  wordSearch: string; setWordSearch: (v: string) => void
  sortBy: SortOption; setSortBy: (v: SortOption) => void
  levelFilter: 'all' | WordKnowledgeLevel; setLevelFilter: (v: 'all' | WordKnowledgeLevel) => void
  onReset: () => void
  // counts/meta
  totalWordsOverall: number; topicTotalCount: number; filteredCount: number
  pageStart: number; pageEnd: number
  levelSummary: Record<WordKnowledgeLevel, number>
  topicName?: string
  // paged words
  pageWords: Word[]
  page: number; totalPages: number
  pageSize: number; setPageSize: (n: number) => void
  setPage: (p: number) => void
  // word actions
  pendingWordId: number | null
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
  fromTopicSlug?: string
  isLoading?: boolean
  // empty state
  emptyMessage?: string
}

export function WordCollectionView({
  wordSearch, setWordSearch, sortBy, setSortBy, levelFilter, setLevelFilter,
  onReset, totalWordsOverall, topicTotalCount, filteredCount,
  pageStart, pageEnd, levelSummary, topicName,
  pageWords, page, totalPages, pageSize, setPageSize, setPage,
  pendingWordId, onUpdate, fromTopicSlug,
  isLoading = false,
  emptyMessage = 'No words match the current filters.',
}: Props) {
  function handlePage(p: number) {
    setPage(p)
    document.querySelector('.main-content')?.scrollTo({top: 0, behavior: 'smooth'})
  }

  return (
    <>
      <div className="sticky-controls">
        <WordCollectionToolbar
          wordSearch={wordSearch} setWordSearch={setWordSearch}
          sortBy={sortBy} setSortBy={setSortBy}
          levelFilter={levelFilter} setLevelFilter={setLevelFilter}
          onReset={onReset}
          totalWordsOverall={totalWordsOverall} topicTotalCount={topicTotalCount}
          filteredCount={filteredCount} pageStart={pageStart} pageEnd={pageEnd}
          levelSummary={levelSummary} topicName={topicName}
        />
        {pageWords.length > 0 && (
          <div className="word-list-header" aria-hidden="true">
            <span className="word-list-header-cell">Word</span>
            <span className="word-list-header-cell">Translation / details</span>
            <span className="word-list-header-cell word-list-header-knowledge">Knowledge</span>
          </div>
        )}
      </div>

      <div className="main-inner">
        {isLoading && pageWords.length === 0 ? (
          <WordTableSkeleton />
        ) : pageWords.length === 0 ? (
          <div className="empty-state">{emptyMessage}</div>
        ) : (
          <>
            <WordTable words={pageWords} pendingWordId={pendingWordId} fromTopicSlug={fromTopicSlug} onUpdate={onUpdate} />
            <WordCardList words={pageWords} pendingWordId={pendingWordId} fromTopicSlug={fromTopicSlug} onUpdate={onUpdate} />
          </>
        )}
        <div className="pagination-bar">
          <WordPagination
            page={page} totalPages={totalPages}
            pageSize={pageSize} onPageSize={setPageSize}
            onPage={handlePage}
          />
        </div>
      </div>
    </>
  )
}
