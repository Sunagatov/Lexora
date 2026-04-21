import type {ReactElement} from 'react'
import {TopicButton} from './TopicButton'
import type {TopicTreeNode} from './topicSidebarModel'

type Props = {
  nodes: TopicTreeNode[]
  selectedTopicId: number | null
  isSmartReview: boolean
  topicCounts: Map<number, number>
  topicProgress: Map<number, number>
  pinnedIds: number[]
  onSelect: (id: number) => void
  onDelete: (id: number) => void
  onPin: (id: number) => void
}

function renderNodes(
  nodes: TopicTreeNode[],
  selectedTopicId: number | null,
  isSmartReview: boolean,
  topicCounts: Map<number, number>,
  topicProgress: Map<number, number>,
  pinnedIds: number[],
  level: number,
  onSelect: (id: number) => void,
  onDelete: (id: number) => void,
  onPin: (id: number) => void,
): ReactElement[] {
  return nodes.flatMap((node) => {
    const children = renderNodes(
      node.children,
      selectedTopicId,
      isSmartReview,
      topicCounts,
      topicProgress,
      pinnedIds,
      level + 1,
      onSelect,
      onDelete,
      onPin,
    )

    return [
      <TopicButton
        key={node.topic.id}
        topic={node.topic}
        level={level}
        selectedTopicId={selectedTopicId}
        isSmartReview={isSmartReview}
        topicCounts={topicCounts}
        topicProgress={topicProgress}
        pinnedIds={pinnedIds}
        onSelect={onSelect}
        onDelete={onDelete}
        onPin={onPin}
      />,
      ...children,
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
  onSelect,
  onDelete,
  onPin,
}: Props) {
  return <>{renderNodes(nodes, selectedTopicId, isSmartReview, topicCounts, topicProgress, pinnedIds, 0, onSelect, onDelete, onPin)}</>
}
