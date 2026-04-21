import {useRef, useMemo, useState} from 'react'
import type {ChangeEvent} from 'react'
import {useNavigate} from 'react-router-dom'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {deleteTopic, createTopic} from './api'
import type {StudyQueue, Topic} from '../../shared/types'
import {ApiError} from '../../shared/apiError'
import {ConfirmModal} from '../../shared/ConfirmModal'
import {SortMenu, SORT_LABELS, SORT_OPTIONS} from './TopicSortMenu'
import {TopicButton} from './TopicButton'
import {queryKeys} from '../../shared/queryKeys'
import {routes} from '../../shared/routes'
import {useTopicSidebarPrefs} from './useTopicSidebarPrefs'
import {buildSidebarGroups, weakCount} from './topicSidebarModel'
import {exportWordsWorkbook, importWordsWorkbook} from '../words/api'

type Props = {
  topics: Topic[]
  topicCounts: Map<number, number>
  topicProgress: Map<number, number>
  totalWords: number
  topicSearch: string
  setTopicSearch: (v: string) => void
  selectedTopicId: number | null
  isSmartReview: boolean
  isMobile?: boolean
  onSelect: (id: number) => void
  onSelectSmartReview: () => void
  smartQueue: StudyQueue | null
}

export function TopicSidebar({
  topics, topicCounts, topicProgress, totalWords, topicSearch, setTopicSearch,
  selectedTopicId, isSmartReview, isMobile = false,
  onSelect, onSelectSmartReview, smartQueue,
}: Props) {
  const prefs = useTopicSidebarPrefs()

  function handleSelect(id: number) {
    prefs.addRecentId(id)
    onSelect(id)
  }
  const [posSortOpen,    setPosSortOpen]    = useState(false)
  const [topicsSortOpen, setTopicsSortOpen] = useState(false)
  const [searchOpen,     setSearchOpen]     = useState(false)
  const [deleteTopicId,  setDeleteTopicId]  = useState<number | null>(null)
  const [newTopicName,   setNewTopicName]   = useState('')
  const [addingTopic,    setAddingTopic]    = useState(false)
  const [topicError,     setTopicError]     = useState<string | null>(null)
  const [workbookBusy,   setWorkbookBusy]   = useState(false)
  const searchRef      = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const posSortRef     = useRef<HTMLButtonElement>(null)
  const topicsSortRef  = useRef<HTMLButtonElement>(null)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const createTopicMutation = useMutation({
    mutationFn: () => createTopic(newTopicName.trim()),
    onSuccess: (created) => {
      queryClient.setQueryData<Topic[]>(queryKeys.topics, (cur = []) => [...cur, created])
      setNewTopicName(''); setAddingTopic(false); setTopicError(null)
      navigate(routes.topic(created.slug))
    },
    onError: (err: Error) => setTopicError(err instanceof ApiError && err.status === 409 ? err.message : 'Name already exists or is invalid.'),
  })

  const deleteTopicMutation = useMutation({
    mutationFn: (id: number) => deleteTopic(id, false),
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: queryKeys.topics})
      void queryClient.invalidateQueries({queryKey: queryKeys.words})
      setDeleteTopicId(null)
    },
  })

  const needle = topicSearch.toLowerCase().trim()

  const {posTopics, themeTopics, pinnedTopics, recentTopics} = useMemo(() =>
    buildSidebarGroups(
      topics, needle, prefs.pinnedIds,
      prefs.posSort, prefs.topicsSort,
      prefs.posCollapsed, prefs.topicsCollapsed,
      prefs.recentIds, topicProgress, topicCounts,
    ),
    [topics, needle, prefs.pinnedIds, prefs.posSort, prefs.topicsSort,
     prefs.posCollapsed, prefs.topicsCollapsed, prefs.recentIds, topicProgress, topicCounts],
  )

  const remaining  = smartQueue ? smartQueue.total_count - smartQueue.completed_count : null
  const srProgress = smartQueue && smartQueue.total_count > 0
    ? Math.round((smartQueue.completed_count / smartQueue.total_count) * 100) : 0

  async function handleExportWorkbook() {
    try {
      setWorkbookBusy(true)
      await exportWordsWorkbook()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export workbook.'
      window.alert(message)
    } finally {
      setWorkbookBusy(false)
    }
  }

  async function handleImportWorkbookChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      setWorkbookBusy(true)
      const result = await importWordsWorkbook(file)

      await Promise.all([
        queryClient.invalidateQueries({queryKey: queryKeys.topics}),
        queryClient.invalidateQueries({queryKey: queryKeys.words}),
        queryClient.invalidateQueries({queryKey: queryKeys.stats}),
        queryClient.invalidateQueries({queryKey: queryKeys.smartReview}),
      ])

      const perSheet = result.sheets
        .map((sheet) => `${sheet.topic_name}: +${sheet.created} new, ${sheet.updated} updated`)
        .join('\n')

      window.alert(
        `Workbook imported successfully.\n\nCreated: ${result.created}\nUpdated: ${result.updated}\nSkipped: ${result.skipped}\n\n${perSheet}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import workbook.'
      window.alert(message)
    } finally {
      setWorkbookBusy(false)
    }
  }

  return (
    <>
      <div className="sidebar-counts">
        <span>{topics.length} topics</span>
        <span className="sidebar-counts-sep">·</span>
        <span>{totalWords.toLocaleString()} words</span>
      </div>

      <div className="sidebar-smart-review-wrap">
        <button type="button" className={`sidebar-smart-review-btn ${isSmartReview ? 'active' : ''}`} onClick={onSelectSmartReview}>
          <span className="sidebar-smart-review-title">✨ Daily Word Mix</span>
          {remaining !== null && <span className="sidebar-smart-review-count">{remaining} left</span>}
          {smartQueue && (
            <div className="sidebar-smart-review-bar">
              <div className="sidebar-smart-review-fill" style={{width: `${srProgress}%`}} />
            </div>
          )}
        </button>
      </div>

      <div className="sidebar-search-wrap">
        {isMobile ? (
          searchOpen ? (
            <div className="sidebar-search-mobile-row">
              <input ref={searchRef} className="sidebar-search" type="text" placeholder="Search topics…"
                value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} />
              <button type="button" className="sidebar-search-close" onClick={() => { setSearchOpen(false); setTopicSearch('') }} aria-label="Close search">
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
                </svg>
              </button>
            </div>
          ) : (
            <button type="button" className="sidebar-search-toggle" onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 60) }} aria-label="Search topics">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="6.5" cy="6.5" r="4.5" /><line x1="10" y1="10" x2="14" y2="14" />
              </svg>
              <span>Search</span>
            </button>
          )
        ) : (
          <input className="sidebar-search" type="text" placeholder="Search topics…"
            value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} />
        )}
      </div>

      <div className="sidebar-topic-list">
        {pinnedTopics.length > 0 && (
          <div className="sidebar-group">
            <div className="sidebar-group-header"><span className="sidebar-group-label">📌 Pinned</span></div>
            {pinnedTopics.map((t) => (
              <TopicButton
                key={t.id}
                topic={t}
                selectedTopicId={selectedTopicId}
                isSmartReview={isSmartReview}
                topicCounts={topicCounts}
                topicProgress={topicProgress}
                pinnedIds={prefs.pinnedIds}
                onSelect={handleSelect}
                onDelete={(id: number) => setDeleteTopicId(id)}
                onPin={prefs.togglePin}
              />
            ))}
          </div>
        )}
        {recentTopics.length > 0 && (
          <div className="sidebar-group">
            <div className="sidebar-group-header"><span className="sidebar-group-label">🕒 Recent</span></div>
            {recentTopics.map((t) => (
              <TopicButton
                key={t.id}
                topic={t}
                selectedTopicId={selectedTopicId}
                isSmartReview={isSmartReview}
                topicCounts={topicCounts}
                topicProgress={topicProgress}
                pinnedIds={prefs.pinnedIds}
                onSelect={handleSelect}
                onDelete={(id: number) => setDeleteTopicId(id)}
                onPin={prefs.togglePin}
              />
            ))}
          </div>
        )}

        {posTopics.length > 0 && (
          <div className="sidebar-group">
            <div className="sidebar-group-header">
              <button type="button" className="sidebar-group-toggle" onClick={() => prefs.setPosCollapsed(!prefs.posCollapsed)}>
                <svg className={`sidebar-group-chevron ${prefs.posCollapsed ? 'collapsed' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="2,4 6,8 10,4" />
                </svg>
                <span>Parts of Speech</span>
                <span className="sidebar-group-count">{posTopics.length}</span>
              </button>
              <div className="sidebar-sort-wrap">
                <button ref={posSortRef} type="button" className={`sidebar-sort-btn ${prefs.posSort !== 'weakest' ? 'active' : ''}`} onClick={() => setPosSortOpen((v) => !v)} aria-label="Sort">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <line x1="2" y1="4" x2="12" y2="4"/><line x1="4" y1="7" x2="10" y2="7"/><line x1="6" y1="10" x2="8" y2="10"/>
                  </svg>
                </button>
                {posSortOpen && <SortMenu options={SORT_OPTIONS} current={prefs.posSort} anchorRef={posSortRef} onSelect={(m) => { prefs.setPosSort(m); setPosSortOpen(false) }} onClose={() => setPosSortOpen(false)} />}
              </div>
            </div>
            {prefs.posSort !== 'weakest' && prefs.posSort !== 'default' && (
              <div className="sidebar-group-meta">
                {SORT_LABELS[prefs.posSort]}
                {weakCount(posTopics, topicProgress, topicCounts) > 0 && <> · <span className="sidebar-group-meta-weak">{weakCount(posTopics, topicProgress, topicCounts)} weak</span></>}
              </div>
            )}
            {!prefs.posCollapsed && posTopics.map((t) => (
              <TopicButton
                key={t.id}
                topic={t}
                selectedTopicId={selectedTopicId}
                isSmartReview={isSmartReview}
                topicCounts={topicCounts}
                topicProgress={topicProgress}
                pinnedIds={prefs.pinnedIds}
                onSelect={handleSelect}
                onDelete={(id: number) => setDeleteTopicId(id)}
                onPin={prefs.togglePin}
              />
            ))}
          </div>
        )}

        {themeTopics.length > 0 && (
          <div className="sidebar-group">
            <div className="sidebar-group-header">
              <button type="button" className="sidebar-group-toggle" onClick={() => prefs.setTopicsCollapsed(!prefs.topicsCollapsed)}>
                <svg className={`sidebar-group-chevron ${prefs.topicsCollapsed ? 'collapsed' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="2,4 6,8 10,4" />
                </svg>
                <span>Topics</span>
                <span className="sidebar-group-count">{themeTopics.length}</span>
              </button>
              <div className="sidebar-sort-wrap">
                <button ref={topicsSortRef} type="button" className={`sidebar-sort-btn ${prefs.topicsSort !== 'weakest' ? 'active' : ''}`} onClick={() => setTopicsSortOpen((v) => !v)} aria-label="Sort">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <line x1="2" y1="4" x2="12" y2="4"/><line x1="4" y1="7" x2="10" y2="7"/><line x1="6" y1="10" x2="8" y2="10"/>
                  </svg>
                </button>
                {topicsSortOpen && <SortMenu options={SORT_OPTIONS} current={prefs.topicsSort} anchorRef={topicsSortRef} onSelect={(m) => { prefs.setTopicsSort(m); setTopicsSortOpen(false) }} onClose={() => setTopicsSortOpen(false)} />}
              </div>
            </div>
            {prefs.topicsSort !== 'weakest' && prefs.topicsSort !== 'default' && (
              <div className="sidebar-group-meta">
                {SORT_LABELS[prefs.topicsSort]}
                {weakCount(themeTopics, topicProgress, topicCounts) > 0 && <> · <span className="sidebar-group-meta-weak">{weakCount(themeTopics, topicProgress, topicCounts)} below 30%</span></>}
              </div>
            )}
            {!prefs.topicsCollapsed && themeTopics.map((t) => (
              <TopicButton
                key={t.id}
                topic={t}
                selectedTopicId={selectedTopicId}
                isSmartReview={isSmartReview}
                topicCounts={topicCounts}
                topicProgress={topicProgress}
                pinnedIds={prefs.pinnedIds}
                onSelect={handleSelect}
                onDelete={(id: number) => setDeleteTopicId(id)}
                onPin={prefs.togglePin}
              />
            ))}
          </div>
        )}

        {posTopics.length === 0 && themeTopics.length === 0 && (
          <div className="sidebar-empty">No topics found.</div>
        )}
      </div>

      <div className="sidebar-footer">
        {addingTopic ? (
          <div className="sidebar-new-topic-wrap">
            <div className="sidebar-new-topic-form">
              <input className="sidebar-new-topic-input" placeholder="Topic name…" value={newTopicName} autoFocus maxLength={200}
                onChange={(e) => { setNewTopicName(e.target.value); setTopicError(null) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTopicName.trim()) createTopicMutation.mutate()
                  if (e.key === 'Escape') { setAddingTopic(false); setNewTopicName(''); setTopicError(null) }
                }}
              />
              <button type="button" className="sidebar-new-topic-save" disabled={!newTopicName.trim() || createTopicMutation.isPending} onClick={() => createTopicMutation.mutate()}>
                {createTopicMutation.isPending ? '…' : 'Add'}
              </button>
              <button type="button" className="sidebar-new-topic-cancel" onClick={() => { setAddingTopic(false); setNewTopicName(''); setTopicError(null) }}>
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
                </svg>
              </button>
            </div>
            {topicError && <div className="sidebar-new-topic-error">{topicError}</div>}
          </div>
        ) : (
          <button type="button" className="sidebar-add-topic-btn" onClick={() => setAddingTopic(true)}>+ New topic</button>
        )}
        <div className="sidebar-util-row">
          <button type="button" className="sidebar-util-btn" title="Statistics" onClick={() => navigate(routes.stats)}>
            <span className="sidebar-util-icon">📊</span><span className="sidebar-util-label">Stats</span>
          </button>
          <button type="button" className="sidebar-util-btn" title="Trash" onClick={() => navigate(routes.trash)}>
            <span className="sidebar-util-icon">🗑</span><span className="sidebar-util-label">Trash</span>
          </button>
        </div>
        <div className="sidebar-util-row">
          <button type="button" className="sidebar-util-btn" title="Export Excel workbook" disabled={workbookBusy} onClick={handleExportWorkbook}>
            <span className="sidebar-util-icon">Export</span><span className="sidebar-util-label">XLSX</span>
          </button>
          <button type="button" className="sidebar-util-btn" title="Import Excel workbook" disabled={workbookBusy} onClick={() => importInputRef.current?.click()}>
            <span className="sidebar-util-icon">Import</span><span className="sidebar-util-label">{workbookBusy ? 'Working' : 'XLSX'}</span>
          </button>
        </div>
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          style={{display: 'none'}}
          onChange={handleImportWorkbookChange}
        />
      </div>

      {deleteTopicId !== null && (
        <ConfirmModal
          title="Delete Topic?"
          message={`Are you sure you want to delete "${topics.find(t => t.id === deleteTopicId)?.name}"? The topic will be moved to trash. Words that belong only to this topic will also be trashed; shared words will not be affected.`}
          confirmLabel="Delete" danger
          onConfirm={() => deleteTopicMutation.mutate(deleteTopicId)}
          onCancel={() => setDeleteTopicId(null)}
        />
      )}
    </>
  )
}
