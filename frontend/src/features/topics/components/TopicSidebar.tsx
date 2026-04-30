import {useEffect, useRef, useMemo, useState} from 'react'
import {useNavigate} from 'react-router-dom'
import type {StudyQueue, Topic} from '@/shared/types'
import {ConfirmModal} from '@/shared/ui/ConfirmModal'
import {SORT_LABELS} from '@/features/topics/model/topicSort'
import {TopicButton} from '@/features/topics/components/TopicButton'
import {routes} from '@/app/routes'
import {useTopicSidebarPrefs} from '@/features/topics/hooks/useTopicSidebarPrefs'
import {buildSidebarGroups, isPosGroup, weakCount} from '@/features/topics/model/topicSidebarModel'
import {TopicSidebarGroup} from '@/features/topics/components/TopicSidebarGroup'
import {TopicSidebarListSection} from '@/features/topics/components/TopicSidebarListSection'
import {TopicSidebarTree} from '@/features/topics/components/TopicSidebarTree'
import {TopicSidebarFooter} from '@/features/topics/components/TopicSidebarFooter'
import {TopicSidebarHeader} from '@/features/topics/components/TopicSidebarHeader'
import {TopicEditModal} from '@/features/topics/components/TopicEditModal'
import {useTopicSidebarActions} from '@/features/topics/hooks/useTopicSidebarActions'

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
  const posSortRef     = useRef<HTMLButtonElement>(null)
  const topicsSortRef  = useRef<HTMLButtonElement>(null)
  const lastAutoExpandedTopicIdRef = useRef<number | null>(null)
  const navigate    = useNavigate()
  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === selectedTopicId) ?? null,
    [topics, selectedTopicId],
  )
  const {
    importInputRef,
    addingTopic,
    newTopicName,
    setNewTopicName,
    newTopicParentId,
    setNewTopicParentId,
    topicError,
    setTopicError,
    workbookBusy,
    deleteTopicId,
    setDeleteTopicId,
    deleteTopicError,
    setDeleteTopicError,
    editTopicId,
    setEditTopicId,
    editTopicError,
    setEditTopicError,
    editingTopic,
    createTopicMutation,
    deleteTopicMutation,
    updateTopicMutation,
    handleExportWorkbook,
    handleImportWorkbookChange,
    startAddTopic,
    cancelAddTopic,
  } = useTopicSidebarActions({
    topics,
    selectedTopic,
    canUseSelectedTopicAsParent: !isSmartReview && !!selectedTopic && !isPosGroup(selectedTopic),
  })

  const needle = topicSearch.toLowerCase().trim()

  const topicOptions = useMemo(
    () => [...topics].filter((t) => !isPosGroup(t)).sort((a, b) => a.name.localeCompare(b.name)),
    [topics],
  )

  useEffect(() => {
    if (selectedTopicId === null) {
      lastAutoExpandedTopicIdRef.current = null
      return
    }
    if (lastAutoExpandedTopicIdRef.current === selectedTopicId) return

    const byId = new Map(topics.map((topic) => [topic.id, topic]))
    const expanded = new Set(prefs.expandedTopicIds)
    let currentId: number | null = selectedTopicId
    let changed = false

    while (currentId !== null) {
      if (!expanded.has(currentId)) {
        expanded.add(currentId)
        changed = true
      }
      currentId = byId.get(currentId)?.parent_topic_id ?? null
    }

    lastAutoExpandedTopicIdRef.current = selectedTopicId
    if (changed) prefs.setExpandedTopicIds([...expanded])
  }, [prefs, selectedTopicId, topics])

  const expandedTopicIds = useMemo(
    () => new Set(prefs.expandedTopicIds),
    [prefs.expandedTopicIds],
  )

  const {posTopics, themeTopics, themeTree, pinnedTopics} = useMemo(() =>
    buildSidebarGroups(
      topics, needle, prefs.pinnedIds,
      prefs.posSort, prefs.topicsSort,
      prefs.posCollapsed, prefs.topicsCollapsed,
      prefs.recentIds, topicProgress, topicCounts,
    ),
    [topics, needle, prefs.pinnedIds, prefs.posSort, prefs.topicsSort,
     prefs.posCollapsed, prefs.topicsCollapsed, prefs.recentIds, topicProgress, topicCounts],
  )
  return (
    <>
      <TopicSidebarHeader
        topicCount={topics.length}
        totalWords={totalWords}
        topicSearch={topicSearch}
        setTopicSearch={setTopicSearch}
        isMobile={isMobile}
        isSmartReview={isSmartReview}
        onSelectSmartReview={onSelectSmartReview}
        smartQueue={smartQueue}
      />

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
              expandedTopicIds={expandedTopicIds}
              forceExpandAll={!!needle}
              onSelect={handleSelect}
              onEdit={handleEditTopic}
              onDelete={(id: number) => {
                setDeleteTopicId(id)
                setDeleteTopicError(null)
              }}
              onPin={prefs.togglePin}
              onToggleExpanded={prefs.toggleTopicExpanded}
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
        onCancel={cancelAddTopic}
        onStartAdd={startAddTopic}
        onOpenStats={() => navigate(routes.stats)}
        onOpenTrash={() => navigate(routes.trash)}
        onExport={handleExportWorkbook}
        onImportClick={() => importInputRef.current?.click()}
        onImportChange={handleImportWorkbookChange}
      />

      {deleteTopicId !== null && (
        <ConfirmModal
          title="Delete Topic?"
          message={`Are you sure you want to delete "${topics.find(t => t.id === deleteTopicId)?.name}"? The topic will be moved to trash. Words that would lose their last active topic will also be trashed; words that still belong to another active topic will stay available.`}
          error={deleteTopicError}
          confirmLabel="Delete" danger
          pending={deleteTopicMutation.isPending}
          onConfirm={() => deleteTopicMutation.mutate(deleteTopicId)}
          onCancel={() => {
            setDeleteTopicId(null)
            setDeleteTopicError(null)
          }}
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
