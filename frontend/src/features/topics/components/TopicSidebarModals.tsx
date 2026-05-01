import {ConfirmModal} from '@/shared/ui/ConfirmModal'
import {TopicEditModal} from '@/features/topics/components/TopicEditModal'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {TopicUpdatePayload} from '@/features/topics/api/topicsApi'

type Props = {
  topics: Topic[]
  deleteTopicId: number | null
  deleteTopicError: string | null
  deletePending: boolean
  onConfirmDelete: (id: number) => void
  onCancelDelete: () => void
  editTopicId: number | null
  editingTopic: Topic | null
  editTopicError: string | null
  editPending: boolean
  onCancelEdit: () => void
  onSaveEdit: (payload: TopicUpdatePayload, topicId: number) => void
}

export function TopicSidebarModals({
  topics,
  deleteTopicId,
  deleteTopicError,
  deletePending,
  onConfirmDelete,
  onCancelDelete,
  editTopicId,
  editingTopic,
  editTopicError,
  editPending,
  onCancelEdit,
  onSaveEdit,
}: Props) {
  return (
    <>
      {deleteTopicId !== null && (
        <ConfirmModal
          title="Delete Topic?"
          message={`Are you sure you want to delete "${topics.find((topic) => topic.id === deleteTopicId)?.name}"? The topic will be moved to trash. Words that would lose their last active topic will also be trashed; words that still belong to another active topic will stay available.`}
          error={deleteTopicError}
          confirmLabel="Delete"
          danger
          pending={deletePending}
          onConfirm={() => onConfirmDelete(deleteTopicId)}
          onCancel={onCancelDelete}
        />
      )}

      {editTopicId !== null && editingTopic && (
        <TopicEditModal
          topic={editingTopic}
          topics={topics}
          saving={editPending}
          error={editTopicError}
          onCancel={onCancelEdit}
          onSave={(payload) => onSaveEdit(payload, editingTopic.id)}
        />
      )}
    </>
  )
}
