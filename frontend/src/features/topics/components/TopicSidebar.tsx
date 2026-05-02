import {useEffect, useMemo, useRef, useState, type ReactElement} from 'react'
import {useNavigate} from 'react-router-dom'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import type {Topic} from '@/features/topics/types/topicTypes'
import {routes} from '@/app/routes'
import {useTopicSidebarPrefs} from '@/features/topics/hooks/useTopicSidebarPrefs'
import {buildSidebarGroups, isPosGroup, type TopicTreeNode} from '@/features/topics/model/topicSidebarModel'
import {TopicSidebarFooter} from '@/features/topics/components/TopicSidebarFooter'
import {TopicSidebarHeader} from '@/features/topics/components/TopicSidebarHeader'
import {useTopicSidebarActions} from '@/features/topics/hooks/useTopicSidebarActions'
import {TopicSidebarGroup} from '@/features/topics/components/TopicSidebarGroup'
import {TopicButton} from '@/features/topics/components/TopicButton'
import {SORT_LABELS, type SortMode} from '@/features/topics/model/topicSort'
import {ConfirmModal} from '@/shared/ui/ConfirmModal'
import {TopicEditModal} from '@/features/topics/components/TopicEditModal'
import type {TopicUpdatePayload} from '@/features/topics/api/topicsApi'

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
  isCollapsed?: boolean
  onToggleCollapsed?: () => void
}

type TopicButtonSharedProps = {
  selectedTopicId: number | null
  isSmartReview: boolean
  topicCounts: Map<number, number>
  topicProgress: Map<number, number>
  pinnedIds: number[]
  onSelect: (id: number) => void
  onEdit: (id: number) => void
  onDelete: (id: number) => void
  onPin: (id: number) => void
  onToggleExpanded: (id: number) => void
}

function buildTopicGroupMeta(
  sortMode: SortMode,
  topics: Topic[],
  topicProgress: Map<number, number>,
  topicCounts: Map<number, number>,
  weakLabel: string,
) {
  if (sortMode === 'weakest' || sortMode === 'default') return null

  const weakTotal = topics.reduce((count, topic) => {
    const progress = topicProgress.get(topic.id)
    const total = topicCounts.get(topic.id) ?? 0
    if (progress === undefined || total === 0 || progress >= 30) return count
    return count + 1
  }, 0)

  return (
    <>
      {SORT_LABELS[sortMode]}
      {weakTotal > 0 && <> · <span className="sidebar-group-meta-weak">{weakTotal} {weakLabel}</span></>}
    </>
  )
}

function renderTopicTree(
  nodes: TopicTreeNode[],
  shared: TopicButtonSharedProps,
  expandedTopicIds: Set<number>,
  forceExpandAll: boolean,
  level = 0,
  counter = {idx: 0},
): ReactElement[] {
  return nodes.flatMap((node) => {
    const staggerIdx = counter.idx++
    const hasChildren = node.children.length > 0
    const expanded = hasChildren && (forceExpandAll || expandedTopicIds.has(node.topic.id))
    const children = expanded
      ? renderTopicTree(node.children, shared, expandedTopicIds, forceExpandAll, level + 1, counter)
      : []

    return [
      <TopicButton
        key={node.topic.id}
        topic={node.topic}
        selectedTopicId={shared.selectedTopicId}
        isSmartReview={shared.isSmartReview}
        topicCounts={shared.topicCounts}
        topicProgress={shared.topicProgress}
        pinnedIds={shared.pinnedIds}
        onSelect={shared.onSelect}
        onEdit={shared.onEdit}
        onDelete={shared.onDelete}
        onPin={shared.onPin}
        level={level}
        hasChildren={hasChildren}
        expanded={expanded}
        onToggleExpanded={shared.onToggleExpanded}
        staggerIdx={staggerIdx}
      />,
      ...(expanded
        ? [
          <div
            key={`${node.topic.id}-children`}
            className="topic-subtopics-scroll"
            data-level={level + 1}
          >
            {children}
          </div>,
        ]
        : []),
    ]
  })
}

function renderFlatTopicButtons(
  topics: Topic[],
  shared: TopicButtonSharedProps,
): ReactElement[] {
  return topics.map((topic) => (
    <TopicButton
      key={topic.id}
      topic={topic}
      selectedTopicId={shared.selectedTopicId}
      isSmartReview={shared.isSmartReview}
      topicCounts={shared.topicCounts}
      topicProgress={shared.topicProgress}
      pinnedIds={shared.pinnedIds}
      onSelect={shared.onSelect}
      onEdit={shared.onEdit}
      onDelete={shared.onDelete}
      onPin={shared.onPin}
    />
  ))
}

function buildDeleteTopicMessage(topics: Topic[], deleteTopicId: number): string {
  const topicName = topics.find((topic) => topic.id === deleteTopicId)?.name
  return `Are you sure you want to delete "${topicName}"? The topic will be moved to trash. Words that would lose their last active topic will also be trashed; words that still belong to another active topic will stay available.`
}

export function TopicSidebar({
  topics, topicCounts, topicProgress, totalWords, topicSearch, setTopicSearch,
  selectedTopicId, isSmartReview, isMobile = false,
  onSelect, onSelectSmartReview, smartQueue,
  isCollapsed = false, onToggleCollapsed,
}: Props) {
  const prefs = useTopicSidebarPrefs()
  const [posSortOpen, setPosSortOpen] = useState(false)
  const [topicsSortOpen, setTopicsSortOpen] = useState(false)
  const posSortRef = useRef<HTMLButtonElement>(null)
  const topicsSortRef = useRef<HTMLButtonElement>(null)

  function handleSelect(id: number) {
    prefs.addRecentId(id)
    onSelect(id)
  }
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
    changeNewTopicName,
    newTopicParentId,
    setNewTopicParentId,
    topicError,
    workbookBusy,
    deleteTopicId,
    openDeleteTopic,
    closeDeleteTopic,
    deleteTopicError,
    editTopicId,
    openEditTopic,
    closeEditTopic,
    editTopicError,
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
  const posMeta = useMemo(
    () => buildTopicGroupMeta(prefs.posSort, posTopics, topicProgress, topicCounts, 'weak'),
    [prefs.posSort, posTopics, topicProgress, topicCounts],
  )
  const topicsMeta = useMemo(
    () => buildTopicGroupMeta(prefs.topicsSort, themeTopics, topicProgress, topicCounts, 'below 30%'),
    [prefs.topicsSort, themeTopics, topicProgress, topicCounts],
  )
  const topicButtonSharedProps: TopicButtonSharedProps = {
    selectedTopicId,
    isSmartReview,
    topicCounts,
    topicProgress,
    pinnedIds: prefs.pinnedIds,
    onSelect: handleSelect,
    onEdit: openEditTopic,
    onDelete: openDeleteTopic,
    onPin: prefs.togglePin,
    onToggleExpanded: prefs.toggleTopicExpanded,
  }

  return (
    <>
      {!isMobile && (
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggleCollapsed}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={isCollapsed ? '4,2 9,7 4,12' : '9,2 4,7 9,12'} />
          </svg>
        </button>
      )}

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
          <div className="sidebar-group">
            <div className="sidebar-group-header">
              <span className="sidebar-group-label">📌 Pinned</span>
            </div>
            {renderFlatTopicButtons(pinnedTopics, topicButtonSharedProps)}
          </div>
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
            onToggleSort={() => setPosSortOpen((value) => !value)}
            onCloseSort={() => setPosSortOpen(false)}
            onSelectSort={(mode) => {
              prefs.setPosSort(mode)
              setPosSortOpen(false)
            }}
            meta={posMeta}
          >
            {renderFlatTopicButtons(posTopics, topicButtonSharedProps)}
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
            onToggleSort={() => setTopicsSortOpen((value) => !value)}
            onCloseSort={() => setTopicsSortOpen(false)}
            onSelectSort={(mode) => {
              prefs.setTopicsSort(mode)
              setTopicsSortOpen(false)
            }}
            meta={topicsMeta}
          >
            {renderTopicTree(
              themeTree,
              {
                ...topicButtonSharedProps,
                onDelete: openDeleteTopic,
              },
              expandedTopicIds,
              !!needle,
            )}
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
        onNewTopicNameChange={changeNewTopicName}
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
          message={buildDeleteTopicMessage(topics, deleteTopicId)}
          error={deleteTopicError}
          confirmLabel="Delete"
          danger
          pending={deleteTopicMutation.isPending}
          onConfirm={() => deleteTopicMutation.mutate(deleteTopicId)}
          onCancel={closeDeleteTopic}
        />
      )}

      {editTopicId !== null && editingTopic && (
        <TopicEditModal
          topic={editingTopic}
          topics={topics}
          saving={updateTopicMutation.isPending}
          error={editTopicError}
          onCancel={closeEditTopic}
          onSave={(payload: TopicUpdatePayload) => updateTopicMutation.mutate({id: editingTopic.id, payload})}
        />
      )}
    </>
  )
}
