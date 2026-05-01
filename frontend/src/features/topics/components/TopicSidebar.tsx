import {useEffect, useRef, useMemo} from 'react'
import {useNavigate} from 'react-router-dom'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import type {Topic} from '@/features/topics/types/topicTypes'
import {routes} from '@/app/routes'
import {useTopicSidebarPrefs} from '@/features/topics/hooks/useTopicSidebarPrefs'
import {buildSidebarGroups, isPosGroup} from '@/features/topics/model/topicSidebarModel'
import {TopicSidebarFooter} from '@/features/topics/components/TopicSidebarFooter'
import {TopicSidebarHeader} from '@/features/topics/components/TopicSidebarHeader'
import {useTopicSidebarActions} from '@/features/topics/hooks/useTopicSidebarActions'
import {buildTopicGroupMeta, TopicSidebarSections} from '@/features/topics/components/TopicSidebarSections'
import {TopicSidebarModals} from '@/features/topics/components/TopicSidebarModals'

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
  const posMeta = useMemo(
    () => buildTopicGroupMeta(prefs.posSort, posTopics, topicProgress, topicCounts, 'weak'),
    [prefs.posSort, posTopics, topicProgress, topicCounts],
  )
  const topicsMeta = useMemo(
    () => buildTopicGroupMeta(prefs.topicsSort, themeTopics, topicProgress, topicCounts, 'below 30%'),
    [prefs.topicsSort, themeTopics, topicProgress, topicCounts],
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

      <TopicSidebarSections
        pinnedTopics={pinnedTopics}
        posTopics={posTopics}
        themeTopics={themeTopics}
        themeTree={themeTree}
        selectedTopicId={selectedTopicId}
        isSmartReview={isSmartReview}
        topicCounts={topicCounts}
        topicProgress={topicProgress}
        pinnedIds={prefs.pinnedIds}
        expandedTopicIds={expandedTopicIds}
        forceExpandAll={!!needle}
        posCollapsed={prefs.posCollapsed}
        topicsCollapsed={prefs.topicsCollapsed}
        posSort={prefs.posSort}
        topicsSort={prefs.topicsSort}
        onSelect={handleSelect}
        onEdit={handleEditTopic}
        onDelete={setDeleteTopicId}
        onDeleteFromTree={(id) => {
          setDeleteTopicId(id)
          setDeleteTopicError(null)
        }}
        onPin={prefs.togglePin}
        onToggleExpanded={prefs.toggleTopicExpanded}
        onTogglePosCollapsed={() => prefs.setPosCollapsed(!prefs.posCollapsed)}
        onToggleTopicsCollapsed={() => prefs.setTopicsCollapsed(!prefs.topicsCollapsed)}
        onSelectPosSort={prefs.setPosSort}
        onSelectTopicsSort={prefs.setTopicsSort}
        posMeta={posMeta}
        topicsMeta={topicsMeta}
      />

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

      <TopicSidebarModals
        topics={topics}
        deleteTopicId={deleteTopicId}
        deleteTopicError={deleteTopicError}
        deletePending={deleteTopicMutation.isPending}
        onConfirmDelete={(id) => deleteTopicMutation.mutate(id)}
        onCancelDelete={() => {
          setDeleteTopicId(null)
          setDeleteTopicError(null)
        }}
        editTopicId={editTopicId}
        editingTopic={editingTopic}
        editTopicError={editTopicError}
        editPending={updateTopicMutation.isPending}
        onCancelEdit={() => {
          setEditTopicId(null)
          setEditTopicError(null)
        }}
        onSaveEdit={(payload, topicId) => updateTopicMutation.mutate({id: topicId, payload})}
      />
    </>
  )
}
