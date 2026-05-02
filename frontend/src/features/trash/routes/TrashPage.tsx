import {useNavigate} from 'react-router-dom'
import {ConfirmModal} from '@/shared/ui/ConfirmModal'
import {routes} from '@/app/routes'
import {useTrashPageState} from '@/features/trash/hooks/useTrashPageState'

export function TrashPage() {
  const navigate = useNavigate()
  const {
    retentionDays,
    words,
    topics,
    confirmPurge,
    setConfirmPurge,
    restoreTopicId,
    restoreTopicError,
    restoreWordError,
    pendingRestoreTopic,
    restoreWordMutation,
    restoreTopicMutation,
    purgeMutation,
    openRestoreTopic,
    clearRestoreTopicDialog,
    restoreSingleWord,
    daysLeft,
  } = useTrashPageState()

  return (
    <div className="trash-page">
      <div className="trash-inner">
        <div className="trash-topbar">
          <button type="button" className="word-page-back-btn" onClick={() => navigate(routes.smartReview)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12" />
            </svg>
            Back
          </button>
          {(words.length > 0 || topics.length > 0) && (
            <button type="button" className="trash-purge-btn" onClick={() => setConfirmPurge(true)}>
              Empty Trash
            </button>
          )}
        </div>

        <h1 className="trash-title">Trash</h1>
        <p className="trash-subtitle">Items are permanently deleted after {retentionDays} days.</p>

        {topics.length > 0 && (
          <section className="trash-section">
            <div className="trash-section-label">Topics ({topics.length})</div>
            {topics.map((topic) => (
              <div key={topic.id} className="trash-item">
                <div className="trash-item-info">
                  <span className="trash-item-name">{topic.name}</span>
                  <span className="trash-item-days">{daysLeft(topic.deleted_at)} days left</span>
                </div>
                <button
                  type="button"
                  className="trash-restore-btn"
                  onClick={() => openRestoreTopic(topic.id)}
                  disabled={restoreTopicMutation.isPending}
                >
                  Restore
                </button>
              </div>
            ))}
          </section>
        )}

        {words.length > 0 && (
          <section className="trash-section">
            <div className="trash-section-label">Words ({words.length})</div>
            {words.map((word) => (
              <div key={word.id} className="trash-item">
                <div className="trash-item-info">
                  <span className="trash-item-name">{word.term}</span>
                  <span className="trash-item-meta">{word.translation_entries.join(', ')}</span>
                  <span className="trash-item-days">{daysLeft(word.deleted_at)} days left</span>
                  {restoreWordError?.id === word.id && (
                    <span className="login-error">{restoreWordError.message}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="trash-restore-btn"
                  onClick={() => restoreSingleWord(word.id)}
                  disabled={restoreWordMutation.isPending}
                >
                  Restore
                </button>
              </div>
            ))}
          </section>
        )}

        {words.length === 0 && topics.length === 0 && <div className="trash-empty">Trash is empty.</div>}
      </div>

      {confirmPurge && (
        <ConfirmModal
          title="Empty Trash?"
          message="This will permanently delete everything in Trash right now. This cannot be undone."
          confirmLabel="Empty Trash"
          danger
          pending={purgeMutation.isPending}
          onConfirm={() => purgeMutation.mutate()}
          onCancel={() => setConfirmPurge(false)}
        />
      )}

      {restoreTopicId !== null && pendingRestoreTopic && (
        <ConfirmModal
          title={`Restore "${pendingRestoreTopic.name}"?`}
          message="Do you also want to restore all words that were deleted with this topic?"
          error={restoreTopicError}
          confirmLabel="Restore topic + words"
          cancelLabel="Restore topic only"
          pending={restoreTopicMutation.isPending}
          onConfirm={() => restoreTopicMutation.mutate({id: restoreTopicId, restoreWords: true})}
          onCancel={() => restoreTopicMutation.mutate({id: restoreTopicId, restoreWords: false})}
          onClose={clearRestoreTopicDialog}
        />
      )}
    </div>
  )
}
