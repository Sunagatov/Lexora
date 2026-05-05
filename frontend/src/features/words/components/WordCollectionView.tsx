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
import type {SortOption, CefrLevel, PosValue, CompletenessFilter} from '@/features/words/model/wordDomain'
import {WordCollectionToolbar} from '@/features/words/components/WordCollectionToolbar'
import {WordPagination} from '@/features/words/components/WordPagination'
import {WordTable} from '@/features/words/components/WordTable'
import {WordCardList} from '@/features/words/components/WordCardList'

type Props = {
  wordSearch: string; setWordSearch: (v: string) => void
  sortBy: SortOption; setSortBy: (v: SortOption) => void
  levelFilter: 'all' | WordKnowledgeLevel; setLevelFilter: (v: 'all' | WordKnowledgeLevel) => void
  posFilter: PosValue | null; setPosFilter: (v: PosValue | null) => void
  cefrFilter: CefrLevel | null; setCefrFilter: (v: CefrLevel | null) => void
  completeness: CompletenessFilter; setCompleteness: (v: CompletenessFilter) => void
  onReset: () => void
  totalWordsOverall: number; topicTotalCount: number; filteredCount: number
  pageStart: number; pageEnd: number
  levelSummary: Record<WordKnowledgeLevel, number>
  pageWords: Word[]
  page: number; totalPages: number
  pageSize: number; setPageSize: (n: number) => void
  setPage: (p: number) => void
  pendingWordId: number | null
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
  fromTopicSlug?: string
  isLoading?: boolean
  emptyMessage?: string
  onWordSelect?: (id: number) => void
  selectedWordId?: number | null
}

export function WordCollectionView({
  wordSearch, setWordSearch, sortBy, setSortBy, levelFilter, setLevelFilter,
  posFilter, setPosFilter, cefrFilter, setCefrFilter, completeness, setCompleteness,
  onReset, totalWordsOverall, topicTotalCount, filteredCount,
  pageStart, pageEnd, levelSummary,
  pageWords, page, totalPages, pageSize, setPageSize, setPage,
  pendingWordId, onUpdate, fromTopicSlug,
  isLoading = false,
  emptyMessage = 'No words match the current filters.',
  onWordSelect, selectedWordId,
}: Props) {
  function handlePage(p: number) {
    setPage(p)
    document.querySelector('.word-collection-scroll')?.scrollTo({top: 0, behavior: 'smooth'})
  }

  return (
    <div className="word-collection-layout">
      <div className="word-collection-scroll">
        <div className="sticky-controls">
          <WordCollectionToolbar
            wordSearch={wordSearch} setWordSearch={setWordSearch}
            sortBy={sortBy} setSortBy={setSortBy}
            levelFilter={levelFilter} setLevelFilter={setLevelFilter}
            posFilter={posFilter} setPosFilter={setPosFilter}
            cefrFilter={cefrFilter} setCefrFilter={setCefrFilter}
            completeness={completeness} setCompleteness={setCompleteness}
            onReset={onReset}
            totalWordsOverall={totalWordsOverall} topicTotalCount={topicTotalCount}
            filteredCount={filteredCount} pageStart={pageStart} pageEnd={pageEnd}
            levelSummary={levelSummary}
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
            <div className="empty-state word-collection-empty-state">{emptyMessage}</div>
          ) : (
            <>
              <WordTable words={pageWords} pendingWordId={pendingWordId} fromTopicSlug={fromTopicSlug} onUpdate={onUpdate} onWordSelect={onWordSelect} selectedWordId={selectedWordId} />
              <WordCardList words={pageWords} pendingWordId={pendingWordId} fromTopicSlug={fromTopicSlug} onUpdate={onUpdate} />
            </>
          )}
        </div>
      </div>

      <div className="pagination-bar">
        <WordPagination
          page={page} totalPages={totalPages}
          pageSize={pageSize} onPageSize={setPageSize}
          onPage={handlePage}
        />
      </div>
    </div>
  )
}
