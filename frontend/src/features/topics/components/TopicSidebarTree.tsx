import type {ReactElement} from 'react'
import {TopicButton, type TopicButtonActionProps} from '@/features/topics/components/TopicButton'
import type {TopicTreeNode} from '@/features/topics/model/topicSidebarModel'

type Props = TopicButtonActionProps & {
  nodes: TopicTreeNode[]
  selectedTopicId: number | null
  isSmartReview: boolean
  topicCounts: Map<number, number>
  topicProgress: Map<number, number>
  pinnedIds: number[]
  expandedTopicIds: Set<number>
  forceExpandAll?: boolean
  onToggleExpanded: (id: number) => void
}

function renderNodes(
  nodes: TopicTreeNode[],
  selectedTopicId: number | null,
  isSmartReview: boolean,
  topicCounts: Map<number, number>,
  topicProgress: Map<number, number>,
  pinnedIds: number[],
  expandedTopicIds: Set<number>,
  forceExpandAll: boolean,
  level: number,
  counter: {idx: number},
  onSelect: (id: number) => void,
  onEdit: (id: number) => void,
  onDelete: (id: number) => void,
  onPin: (id: number) => void,
  onToggleExpanded: (id: number) => void,
): ReactElement[] {
  return nodes.flatMap((node) => {
    const staggerIdx  = counter.idx++
    const hasChildren = node.children.length > 0
    const expanded = hasChildren && (forceExpandAll || expandedTopicIds.has(node.topic.id))
    const children = expanded
      ? renderNodes(
        node.children,
        selectedTopicId,
        isSmartReview,
        topicCounts,
        topicProgress,
        pinnedIds,
        expandedTopicIds,
        forceExpandAll,
        level + 1,
        counter,
        onSelect,
        onEdit,
        onDelete,
        onPin,
        onToggleExpanded,
      )
      : []

    const childrenBlock = expanded ? (
      <div
        key={`${node.topic.id}-children`}
        className="topic-subtopics-scroll"
        data-level={level + 1}
      >
        {children}
      </div>
    ) : null

    return [
      <TopicButton
        key={node.topic.id}
        topic={node.topic}
        level={level}
        hasChildren={hasChildren}
        expanded={expanded}
        selectedTopicId={selectedTopicId}
        isSmartReview={isSmartReview}
        topicCounts={topicCounts}
        topicProgress={topicProgress}
        pinnedIds={pinnedIds}
        staggerIdx={staggerIdx}
        onSelect={onSelect}
        onEdit={onEdit}
        onDelete={onDelete}
        onPin={onPin}
        onToggleExpanded={onToggleExpanded}
      />,
      ...(childrenBlock ? [childrenBlock] : []),
    ]
  })
}

export function TopicSidebarTree({
  nodes,
  selectedTopicId,
  isSmartReview,
  topicCounts,
  topicProgress,
  pinnedIds,
  expandedTopicIds,
  forceExpandAll = false,
  onSelect,
  onEdit,
  onDelete,
  onPin,
  onToggleExpanded,
}: Props) {
  return (
    <>
      {renderNodes(
        nodes,
        selectedTopicId,
        isSmartReview,
        topicCounts,
        topicProgress,
        pinnedIds,
        expandedTopicIds,
        forceExpandAll,
        0,
        {idx: 0},
        onSelect,
        onEdit,
        onDelete,
        onPin,
        onToggleExpanded,
      )}
    </>
  )
}
