import {useRef, useMemo, useState} from 'react'
import type {ChangeEvent} from 'react'
import {useNavigate} from 'react-router-dom'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {deleteTopic, createTopic, updateTopic, type TopicUpdatePayload} from './api'
import type {StudyQueue, Topic} from '../../shared/types'
import {ApiError} from '../../shared/apiError'
import {ConfirmModal} from '../../shared/ConfirmModal'
import {SORT_LABELS} from './TopicSortMenu'
import {TopicButton} from './TopicButton'
import {queryKeys} from '../../shared/queryKeys'
import {routes} from '../../shared/routes'
import {useTopicSidebarPrefs} from './useTopicSidebarPrefs'
import {buildSidebarGroups, isPosGroup, weakCount} from './topicSidebarModel'
import {TopicSidebarGroup} from './TopicSidebarGroup'
import {TopicSidebarListSection} from './TopicSidebarListSection'
import {TopicSidebarTree} from './TopicSidebarTree'
import {TopicSidebarFooter} from './TopicSidebarFooter'
import {TopicEditModal} from './TopicEditModal'
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
  function handleEditTopic(id: number) {
    setEditTopicId(id)
    setEditTopicError(null)
  }
  const [posSortOpen,    setPosSortOpen]    = useState(false)
  const [topicsSortOpen, setTopicsSortOpen] = useState(false)
  const [searchOpen,     setSearchOpen]     = useState(false)
  const [deleteTopicId,  setDeleteTopicId]  = useState<number | null>(null)
  const [editTopicId,    setEditTopicId]    = useState<number | null>(null)
  const [newTopicName,   setNewTopicName]   = useState('')
  const [newTopicParentId, setNewTopicParentId] = useState<number | ''>('')
  const [addingTopic,    setAddingTopic]    = useState(false)
  const [topicError,     setTopicError]     = useState<string | null>(null)
  const [editTopicError, setEditTopicError] = useState<string | null>(null)
  const [workbookBusy,   setWorkbookBusy]   = useState(false)
  const searchRef      = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)
  const posSortRef     = useRef<HTMLButtonElement>(null)
  const topicsSortRef  = useRef<HTMLButtonElement>(null)
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === selectedTopicId) ?? null,
    [topics, selectedTopicId],
  )
  const editingTopic = useMemo(
    () => topics.find((t) => t.id === editTopicId) ?? null,
    [topics, editTopicId],
  )

  const createTopicMutation = useMutation({
    mutationFn: () => createTopic(newTopicName.trim(), newTopicParentId === '' ? null : newTopicParentId),
    onSuccess: (created) => {
      queryClient.setQueryData<Topic[]>(queryKeys.topics, (cur = []) => [...cur, created])
      void queryClient.invalidateQueries({queryKey: queryKeys.stats})
      setNewTopicName(''); setNewTopicParentId(''); setAddingTopic(false); setTopicError(null)
      navigate(routes.topic(created.slug))
    },
    onError: (err: Error) => setTopicError(err instanceof ApiError && err.status === 409 ? err.message : 'Name already exists or is invalid.'),
  })

  const deleteTopicMutation = useMutation({
    mutationFn: (id: number) => deleteTopic(id, false),
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: queryKeys.topics})
      void queryClient.invalidateQueries({queryKey: queryKeys.words})
      void queryClient.invalidateQueries({queryKey: queryKeys.stats})
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
      void queryClient.invalidateQueries({queryKey: queryKeys.trashWords})
      void queryClient.invalidateQueries({queryKey: queryKeys.trashTopics})
      setDeleteTopicId(null)
    },
  })

  const updateTopicMutation = useMutation({
    mutationFn: ({id, payload}: {id: number; payload: TopicUpdatePayload}) => updateTopic(id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData<Topic[]>(queryKeys.topics, (cur = []) =>
        cur.map((topic) => (topic.id === updated.id ? updated : topic)),
      )
      void queryClient.invalidateQueries({queryKey: queryKeys.words})
      void queryClient.invalidateQueries({queryKey: queryKeys.stats})
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
      setEditTopicId(null)
      setEditTopicError(null)
      navigate(routes.topic(updated.slug), {replace: true})
    },
    onError: (err: Error) => setEditTopicError(
      err instanceof ApiError && err.status === 409 ? err.message : err.message || 'Could not save topic.',
    ),
  })

  const needle = topicSearch.toLowerCase().trim()

  const topicOptions = useMemo(
    () => [...topics].filter((t) => !isPosGroup(t)).sort((a, b) => a.name.localeCompare(b.name)),
    [topics],
  )

  const {posTopics, themeTopics, themeTree, pinnedTopics, recentTopics} = useMemo(() =>
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
          <TopicSidebarListSection label="📌 Pinned">
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
                onEdit={handleEditTopic}
                onDelete={(id: number) => setDeleteTopicId(id)}
                onPin={prefs.togglePin}
              />
            ))}
          </TopicSidebarListSection>
        )}
        {recentTopics.length > 0 && (
          <TopicSidebarListSection label="🕒 Recent">
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
                onEdit={handleEditTopic}
                onDelete={(id: number) => setDeleteTopicId(id)}
                onPin={prefs.togglePin}
              />
            ))}
          </TopicSidebarListSection>
        )}

        {posTopics.length > 0 && (
          <TopicSidebarGroup
            title="Parts of Speech"
            count={posTopics.length}
            collapsed={prefs.posCollapsed}
            onToggleCollapsed={() => prefs.setPosCollapsed(!prefs.posCollapsed)}
            sortMode={prefs.posSort}
            sortButtonRef={posSortRef}
            sortOpen={posSortOpen}
            onToggleSort={() => setPosSortOpen((v) => !v)}
            onCloseSort={() => setPosSortOpen(false)}
            onSelectSort={(m) => { prefs.setPosSort(m); setPosSortOpen(false) }}
            meta={prefs.posSort !== 'weakest' && prefs.posSort !== 'default' ? (
              <>
                {SORT_LABELS[prefs.posSort]}
                {weakCount(posTopics, topicProgress, topicCounts) > 0 && <> · <span className="sidebar-group-meta-weak">{weakCount(posTopics, topicProgress, topicCounts)} weak</span></>}
              </>
            ) : null}
          >
            {posTopics.map((t) => (
              <TopicButton
                key={t.id}
                topic={t}
                selectedTopicId={selectedTopicId}
                isSmartReview={isSmartReview}
                topicCounts={topicCounts}
                topicProgress={topicProgress}
                pinnedIds={prefs.pinnedIds}
                onSelect={handleSelect}
                onEdit={handleEditTopic}
                onDelete={(id: number) => setDeleteTopicId(id)}
                onPin={prefs.togglePin}
              />
            ))}
          </TopicSidebarGroup>
        )}

        {themeTopics.length > 0 && (
          <TopicSidebarGroup
            title="Topics"
            count={themeTopics.length}
            collapsed={prefs.topicsCollapsed}
            onToggleCollapsed={() => prefs.setTopicsCollapsed(!prefs.topicsCollapsed)}
            sortMode={prefs.topicsSort}
            sortButtonRef={topicsSortRef}
            sortOpen={topicsSortOpen}
            onToggleSort={() => setTopicsSortOpen((v) => !v)}
            onCloseSort={() => setTopicsSortOpen(false)}
            onSelectSort={(m) => { prefs.setTopicsSort(m); setTopicsSortOpen(false) }}
            meta={prefs.topicsSort !== 'weakest' && prefs.topicsSort !== 'default' ? (
              <>
                {SORT_LABELS[prefs.topicsSort]}
                {weakCount(themeTopics, topicProgress, topicCounts) > 0 && <> · <span className="sidebar-group-meta-weak">{weakCount(themeTopics, topicProgress, topicCounts)} below 30%</span></>}
              </>
            ) : null}
          >
            <TopicSidebarTree
              nodes={themeTree}
              selectedTopicId={selectedTopicId}
              isSmartReview={isSmartReview}
              topicCounts={topicCounts}
              topicProgress={topicProgress}
              pinnedIds={prefs.pinnedIds}
              onSelect={handleSelect}
              onEdit={handleEditTopic}
              onDelete={(id: number) => setDeleteTopicId(id)}
              onPin={prefs.togglePin}
            />
          </TopicSidebarGroup>
        )}

        {posTopics.length === 0 && themeTopics.length === 0 && (
          <div className="sidebar-empty">No topics found.</div>
        )}
      </div>

      <TopicSidebarFooter
        addingTopic={addingTopic}
        topicError={topicError}
        newTopicName={newTopicName}
        newTopicParentId={newTopicParentId}
        topicOptions={topicOptions}
        createPending={createTopicMutation.isPending}
        workbookBusy={workbookBusy}
        importInputRef={importInputRef}
        onNewTopicNameChange={(value) => { setNewTopicName(value); setTopicError(null) }}
        onNewTopicParentIdChange={setNewTopicParentId}
        onCreate={() => createTopicMutation.mutate()}
        onCancel={() => { setAddingTopic(false); setNewTopicName(''); setNewTopicParentId(''); setTopicError(null) }}
        onStartAdd={() => {
          setNewTopicParentId(selectedTopic && !isPosGroup(selectedTopic) ? selectedTopic.id : '')
          setAddingTopic(true)
        }}
        onOpenStats={() => navigate(routes.stats)}
        onOpenTrash={() => navigate(routes.trash)}
        onExport={handleExportWorkbook}
        onImportClick={() => importInputRef.current?.click()}
        onImportChange={handleImportWorkbookChange}
      />

      {deleteTopicId !== null && (
        <ConfirmModal
          title="Delete Topic?"
          message={`Are you sure you want to delete "${topics.find(t => t.id === deleteTopicId)?.name}"? The topic will be moved to trash. Words that belong only to this topic will also be trashed; shared words will not be affected.`}
          confirmLabel="Delete" danger
          pending={deleteTopicMutation.isPending}
          onConfirm={() => deleteTopicMutation.mutate(deleteTopicId)}
          onCancel={() => setDeleteTopicId(null)}
        />
      )}

      {editTopicId !== null && editingTopic && (
        <TopicEditModal
          topic={editingTopic}
          topics={topics}
          saving={updateTopicMutation.isPending}
          error={editTopicError}
          onCancel={() => { setEditTopicId(null); setEditTopicError(null) }}
          onSave={(payload) => updateTopicMutation.mutate({id: editingTopic.id, payload})}
        />
      )}
    </>
  )
}
