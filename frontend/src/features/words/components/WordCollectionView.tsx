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

import type {ReactNode} from 'react'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import type {SortOption, CefrLevel, PosValue, CompletenessFilter, KnowledgeFilter, Selection} from '@/features/words/model/wordDomain'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {WordListParams} from '@/features/words/api/wordsApi'
import {WordCollectionToolbar} from '@/features/words/components/WordCollectionToolbar'
import {WordPagination} from '@/features/words/components/WordPagination'
import {WordTable} from '@/features/words/components/WordTable'
import {WordCardList} from '@/features/words/components/WordCardList'
import {useWordListScrollRestore} from '@/features/words/hooks/useWordListNavigation'

type Props = {
  collectionTitle?: string
  collectionBreadcrumb?: ReactNode
  collectionAction?: ReactNode
  collectionProgress?: ReactNode
  wordSearch: string; setWordSearch: (v: string) => void
  sortBy: SortOption; setSortBy: (v: SortOption) => void
  levelFilter: KnowledgeFilter; setLevelFilter: (v: KnowledgeFilter) => void
  posFilter: Selection<PosValue>; setPosFilter: (v: Selection<PosValue>) => void
  cefrFilter: Selection<CefrLevel>; setCefrFilter: (v: Selection<CefrLevel>) => void
  thenSortBy?: SortOption | null; setThenSortBy?: (v: SortOption | null) => void
  topicFilter?: number[]; setTopicFilter?: (v: number[]) => void
  topics?: Topic[]
  onLearningSort?: () => void
  completeness: CompletenessFilter; setCompleteness: (v: CompletenessFilter) => void
  onReset: () => void
  totalWordsOverall: number; topicTotalCount: number; filteredCount: number
  pageStart: number; pageEnd: number
  levelSummary: Record<WordKnowledgeLevel, number>
  progressLabel?: string
  progressReady?: boolean
  pageWords: Word[]
  navigationWords?: Word[]
  navigationQuery?: WordListParams
  page: number; totalPages: number
  pageSize: number; setPageSize: (n: number) => void
  setPage: (p: number) => void
  pendingWordId: number | null
  pendingWordIds?: ReadonlySet<number>
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
  fromTopicSlug?: string
  isLoading?: boolean
  emptyMessage?: string
  onWordSelect?: (id: number) => void
  selectedWordId?: number | null
}

export function WordCollectionView({
  collectionTitle, collectionBreadcrumb, collectionAction, collectionProgress,
  wordSearch, setWordSearch, sortBy, setSortBy, levelFilter, setLevelFilter,
  posFilter, setPosFilter, cefrFilter, setCefrFilter, completeness, setCompleteness,
  onReset, totalWordsOverall, topicTotalCount, filteredCount,
  pageStart, pageEnd, levelSummary, progressLabel, progressReady,
  thenSortBy, setThenSortBy, topicFilter, setTopicFilter, topics, onLearningSort,
  pageWords, navigationWords, navigationQuery, page, totalPages, pageSize, setPageSize, setPage,
  pendingWordId, pendingWordIds, onUpdate, fromTopicSlug,
  isLoading = false,
  emptyMessage = 'No words match the current filters.',
  onWordSelect, selectedWordId,
}: Props) {
  useWordListScrollRestore(isLoading)
  const wordList = {
    ids: (navigationWords ?? pageWords).map(word => word.id),
    offset: navigationWords ? 0 : Math.max(0, pageStart - 1),
    total: filteredCount,
    query: navigationQuery,
  }
  function handlePage(p: number) {
    setPage(p)
    document.querySelector('.word-collection-scroll')?.scrollTo({top: 0, behavior: 'smooth'})
  }
  function handlePageSize(size: number) {
    setPageSize(size)
    document.querySelector('.word-collection-scroll')?.scrollTo({top: 0, behavior: 'instant'})
  }

  return (
    <div className="word-collection-layout">
      <div className="sticky-controls">
        <WordCollectionToolbar
          collectionTitle={collectionTitle} collectionBreadcrumb={collectionBreadcrumb} collectionAction={collectionAction} collectionProgress={collectionProgress}
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
          progressLabel={progressLabel}
          progressReady={progressReady}
          thenSortBy={thenSortBy} setThenSortBy={setThenSortBy}
          topicFilter={topicFilter} setTopicFilter={setTopicFilter} topics={topics}
          onLearningSort={onLearningSort}
        />
        {pageWords.length > 0 && (
          <div className="word-list-header" aria-hidden="true">
            <span className="word-list-header-cell">Word</span>
            <span className="word-list-header-cell">Translation / details</span>
            <span className="word-list-header-cell word-list-header-knowledge">Knowledge</span>
          </div>
        )}
      </div>
      <div className="word-collection-scroll">
        <div className="main-inner">
          {isLoading && pageWords.length === 0 ? (
            <WordTableSkeleton />
          ) : pageWords.length === 0 ? (
            <div className="empty-state word-collection-empty-state">{emptyMessage}</div>
          ) : (
            <>
              <WordTable words={pageWords} wordList={wordList} pendingWordId={pendingWordId} pendingWordIds={pendingWordIds} fromTopicSlug={fromTopicSlug} onUpdate={onUpdate} onWordSelect={onWordSelect} selectedWordId={selectedWordId} />
              <WordCardList words={pageWords} wordList={wordList} pendingWordId={pendingWordId} pendingWordIds={pendingWordIds} fromTopicSlug={fromTopicSlug} onUpdate={onUpdate} />
            </>
          )}
        </div>
      </div>

      <div className="pagination-bar">
        <WordPagination
          page={page} totalPages={totalPages}
          pageSize={pageSize} onPageSize={handlePageSize}
          onPage={handlePage}
        />
      </div>
    </div>
  )
}
