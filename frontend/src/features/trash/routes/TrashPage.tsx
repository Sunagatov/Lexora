import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {ConfirmModal} from '@/shared/ui/ConfirmModal'
import {routes} from '@/app/routes'
import {useTrashPageState} from '@/features/trash/hooks/useTrashPageState'

export function TrashPage() {
  const navigate = useNavigate()
  const [speakingId, setSpeakingId] = useState<number | null>(null)
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

  function speak(id: number, term: string) {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(term)
    u.lang = 'en-GB'
    u.rate = 0.92
    u.onstart = () => setSpeakingId(id)
    u.onend = () => setSpeakingId(null)
    u.onerror = () => setSpeakingId(null)
    window.speechSynthesis.speak(u)
  }

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
                  <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                    <span className="trash-item-name">{word.term}</span>
                    <button type="button"
                      className={`wdp-speak-btn ripple-btn${speakingId === word.id ? ' is-speaking' : ''}`}
                      style={{marginLeft: 0}}
                      onClick={() => speak(word.id, word.term)}
                      aria-label={`Pronounce ${word.term}`}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h3l4-3v10l-4-3H3z"/>
                        {speakingId === word.id ? <path d="M11 6.5a2.5 2.5 0 0 1 0 3"/> : <path d="M12.2 5.2a4 4 0 0 1 0 5.6"/>}
                      </svg>
                    </button>
                  </span>
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
