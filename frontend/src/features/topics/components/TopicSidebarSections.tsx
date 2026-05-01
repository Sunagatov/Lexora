import {useRef, useState, type ReactNode} from 'react'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {TopicTreeNode} from '@/features/topics/model/topicSidebarModel'
import type {SortMode} from '@/features/topics/model/topicSort'
import {SORT_LABELS} from '@/features/topics/model/topicSort'
import {TopicButton, type TopicButtonActionProps} from '@/features/topics/components/TopicButton'
import {TopicSidebarGroup} from '@/features/topics/components/TopicSidebarGroup'
import {TopicSidebarListSection} from '@/features/topics/components/TopicSidebarListSection'
import {TopicSidebarTree} from '@/features/topics/components/TopicSidebarTree'

type TopicSidebarSectionTopic = Topic

type TopicButtonListProps = TopicButtonActionProps & {
  selectedTopicId: number | null
  isSmartReview: boolean
  topicCounts: Map<number, number>
  topicProgress: Map<number, number>
  pinnedIds: number[]
}

type Props = TopicButtonActionProps & {
  pinnedTopics: TopicSidebarSectionTopic[]
  posTopics: TopicSidebarSectionTopic[]
  themeTopics: TopicSidebarSectionTopic[]
  themeTree: TopicTreeNode[]
  selectedTopicId: number | null
  isSmartReview: boolean
  topicCounts: Map<number, number>
  topicProgress: Map<number, number>
  pinnedIds: number[]
  expandedTopicIds: Set<number>
  forceExpandAll: boolean
  posCollapsed: boolean
  topicsCollapsed: boolean
  posSort: SortMode
  topicsSort: SortMode
  onDeleteFromTree: (id: number) => void
  onToggleExpanded: (id: number) => void
  onTogglePosCollapsed: () => void
  onToggleTopicsCollapsed: () => void
  onSelectPosSort: (mode: SortMode) => void
  onSelectTopicsSort: (mode: SortMode) => void
  posMeta: ReactNode
  topicsMeta: ReactNode
}

function renderTopicButton(topic: TopicSidebarSectionTopic, props: TopicButtonListProps) {
  return (
    <TopicButton
      key={topic.id}
      topic={topic}
      selectedTopicId={props.selectedTopicId}
      isSmartReview={props.isSmartReview}
      topicCounts={props.topicCounts}
      topicProgress={props.topicProgress}
      pinnedIds={props.pinnedIds}
      onSelect={props.onSelect}
      onEdit={props.onEdit}
      onDelete={props.onDelete}
      onPin={props.onPin}
    />
  )
}

export function buildTopicGroupMeta(
  sortMode: SortMode,
  topics: TopicSidebarSectionTopic[],
  topicProgress: Map<number, number>,
  topicCounts: Map<number, number>,
  weakLabel: string,
) {
  if (sortMode === 'weakest' || sortMode === 'default') return null

  const weakTotal = topics.length > 0
    ? topics.reduce((count, topic) => {
      const progress = topicProgress.get(topic.id)
      const total = topicCounts.get(topic.id) ?? 0
      if (progress === undefined || total === 0 || progress >= 30) return count
      return count + 1
    }, 0)
    : 0

  return (
    <>
      {SORT_LABELS[sortMode]}
      {weakTotal > 0 && <> · <span className="sidebar-group-meta-weak">{weakTotal} {weakLabel}</span></>}
    </>
  )
}

export function TopicSidebarSections({
  pinnedTopics,
  posTopics,
  themeTopics,
  themeTree,
  selectedTopicId,
  isSmartReview,
  topicCounts,
  topicProgress,
  pinnedIds,
  expandedTopicIds,
  forceExpandAll,
  posCollapsed,
  topicsCollapsed,
  posSort,
  topicsSort,
  onSelect,
  onEdit,
  onDelete,
  onDeleteFromTree,
  onPin,
  onToggleExpanded,
  onTogglePosCollapsed,
  onToggleTopicsCollapsed,
  onSelectPosSort,
  onSelectTopicsSort,
  posMeta,
  topicsMeta,
}: Props) {
  const [posSortOpen, setPosSortOpen] = useState(false)
  const [topicsSortOpen, setTopicsSortOpen] = useState(false)
  const posSortRef = useRef<HTMLButtonElement>(null)
  const topicsSortRef = useRef<HTMLButtonElement>(null)
  const topicButtonProps: TopicButtonListProps = {
    selectedTopicId,
    isSmartReview,
    topicCounts,
    topicProgress,
    pinnedIds,
    onSelect,
    onEdit,
    onDelete,
    onPin,
  }

  return (
    <div className="sidebar-topic-list">
      {pinnedTopics.length > 0 && (
        <TopicSidebarListSection label="📌 Pinned">
          {pinnedTopics.map((topic) => renderTopicButton(topic, topicButtonProps))}
        </TopicSidebarListSection>
      )}

      {posTopics.length > 0 && (
        <TopicSidebarGroup
          title="Parts of Speech"
          count={posTopics.length}
          collapsed={posCollapsed}
          onToggleCollapsed={onTogglePosCollapsed}
          sortMode={posSort}
          sortButtonRef={posSortRef}
          sortOpen={posSortOpen}
          onToggleSort={() => setPosSortOpen((value) => !value)}
          onCloseSort={() => setPosSortOpen(false)}
          onSelectSort={(mode) => {
            onSelectPosSort(mode)
            setPosSortOpen(false)
          }}
          meta={posMeta}
        >
          {posTopics.map((topic) => renderTopicButton(topic, topicButtonProps))}
        </TopicSidebarGroup>
      )}

      {themeTopics.length > 0 && (
        <TopicSidebarGroup
          title="Topics"
          count={themeTopics.length}
          collapsed={topicsCollapsed}
          onToggleCollapsed={onToggleTopicsCollapsed}
          sortMode={topicsSort}
          sortButtonRef={topicsSortRef}
          sortOpen={topicsSortOpen}
          onToggleSort={() => setTopicsSortOpen((value) => !value)}
          onCloseSort={() => setTopicsSortOpen(false)}
          onSelectSort={(mode) => {
            onSelectTopicsSort(mode)
            setTopicsSortOpen(false)
          }}
          meta={topicsMeta}
        >
          <TopicSidebarTree
            nodes={themeTree}
            selectedTopicId={selectedTopicId}
            isSmartReview={isSmartReview}
            topicCounts={topicCounts}
            topicProgress={topicProgress}
            pinnedIds={pinnedIds}
            expandedTopicIds={expandedTopicIds}
            forceExpandAll={forceExpandAll}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDeleteFromTree}
            onPin={onPin}
            onToggleExpanded={onToggleExpanded}
          />
        </TopicSidebarGroup>
      )}

      {posTopics.length === 0 && themeTopics.length === 0 && (
        <div className="sidebar-empty">No topics found.</div>
      )}
    </div>
  )
}
