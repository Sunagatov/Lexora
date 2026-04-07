import {useStudyState} from '../hooks/useStudyState'
import {LEVELS, LEVEL_LABELS, levelClass} from '../lib/words'
import {TopicSidebar} from '../components/study/TopicSidebar'
import {Toolbar} from '../components/study/Toolbar'
import {WordTable} from '../components/study/WordTable'
import {WordCardList} from '../components/study/WordCardList'
import {Pagination} from '../components/study/Pagination'

export function StudyPage() {
  const s = useStudyState()

  const sidebarProps = {
    topics: s.visibleTopics,
    topicCounts: s.topicCounts,
    totalWords: s.words.length,
    topicSearch: s.topicSearch,
    setTopicSearch: s.setTopicSearch,
    selectedTopicId: s.selectedTopicId,
    onSelect: s.selectTopic,
  }

  const showWordListHeader = s.selectedTopicId !== null && s.filteredWords.length > 0

  if (s.isLoading) {
    return <div className="study-loading">Loading…</div>
  }

  return (
    <>
      <div className="mobile-topbar">
        <span className="mobile-brand">Lexora</span>
        <button
          type="button"
          className="mobile-topic-btn"
          title={s.selectedTopic?.name ?? 'Topics'}
          onClick={() => s.setDrawerOpen(true)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="2" y1="4" x2="14" y2="4" />
            <line x1="2" y1="8" x2="14" y2="8" />
            <line x1="2" y1="12" x2="14" y2="12" />
          </svg>
          <span className="mobile-topic-btn-name">{s.selectedTopic?.name ?? 'Topics'}</span>
        </button>
      </div>

      <div className={`mobile-drawer-overlay ${s.drawerOpen ? 'open' : ''}`} onClick={() => s.setDrawerOpen(false)} />
      <div className={`mobile-drawer ${s.drawerOpen ? 'open' : ''}`}>
        <TopicSidebar {...sidebarProps} />
      </div>

      <aside className="desktop-sidebar">
        <TopicSidebar {...sidebarProps} />
      </aside>

      <div className="main-content">
        <div className="main-inner">
          <div className="sticky-controls">
            <div className="card topic-header-card">
              <div className="topic-header-main">
                <div className="topic-header-title">{s.selectedTopic?.name ?? 'No topic selected'}</div>
              </div>

              <div className="level-summary">
                {LEVELS.map((l) => (
                  <div key={l} className={`level-chip ${levelClass(l)}`}>
                    <span className="level-chip-label">{LEVEL_LABELS[l]}</span>
                    <span className="level-chip-value">{s.levelSummary[l]}</span>
                  </div>
                ))}
              </div>
            </div>

            <Toolbar
              wordSearch={s.wordSearch}
              setWordSearch={s.setWordSearch}
              sortBy={s.sortBy}
              setSortBy={s.setSortBy}
              levelFilter={s.levelFilter}
              setLevelFilter={s.setLevelFilter}
              onReset={s.resetFilters}
              totalWordsOverall={s.overallWordCount}
              topicTotalCount={s.topicWordCount}
              filteredCount={s.filteredWordCount}
              pageStart={s.pageStart}
              pageEnd={s.pageEnd}
            />

            {showWordListHeader && (
              <div className="word-list-header" aria-hidden="true">
                <span className="word-list-header-cell word-list-header-word">Word</span>
                <span className="word-list-header-cell word-list-header-details">Translation / details</span>
                <span className="word-list-header-cell word-list-header-knowledge">Knowledge</span>
              </div>
            )}
          </div>

          {s.selectedTopicId === null ? (
            <div className="empty-state">Select a topic to start reviewing words.</div>
          ) : s.filteredWords.length === 0 ? (
            <div className="empty-state">No words match the current filters.</div>
          ) : (
            <>
              <WordTable words={s.pageWords} pendingWordId={s.pendingWordId} onUpdate={s.updateLevel} />
              <WordCardList words={s.pageWords} pendingWordId={s.pendingWordId} onUpdate={s.updateLevel} />
            </>
          )}

          {s.totalPages > 1 && (
            <div className="pagination-bar">
              <Pagination
                page={s.page}
                totalPages={s.totalPages}
                onPage={(p) => {
                  s.setPage(p)
                  document.querySelector('.main-content')?.scrollTo({top: 0, behavior: 'smooth'})
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}