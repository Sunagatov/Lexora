import {useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {fetchTrashWords, restoreWord} from '@/features/words/api/wordsApi'
import {fetchTrashTopics, restoreTopic} from '@/features/topics/api/topicsApi'
import {purgeTrash} from '@/features/trash/api/trashApi'
import type {Word, Topic} from '@/shared/types'
import {ConfirmModal} from '@/shared/ui/ConfirmModal'
import {queryKeys} from '@/app/queryKeys'
import {routes} from '@/app/routes'
import {usePublicConfig} from '@/shared/config/usePublicConfig'

export function TrashPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [restoreTopicId, setRestoreTopicId] = useState<number | null>(null)
  const [restoreTopicError, setRestoreTopicError] = useState<string | null>(null)
  const [restoreWordError, setRestoreWordError] = useState<{id: number; message: string} | null>(null)

  const configQuery = usePublicConfig()
  const settings = configQuery.data

  const wordsQuery = useQuery({queryKey: queryKeys.trashWords, queryFn: fetchTrashWords})
  const topicsQuery = useQuery({queryKey: queryKeys.trashTopics, queryFn: fetchTrashTopics})

  const restoreWordMutation = useMutation({
    mutationFn: restoreWord,
    onSuccess: (restored) => {
      queryClient.setQueryData<Word[]>(queryKeys.trashWords, (cur = []) => cur.filter((w) => w.id !== restored.id))
      void queryClient.invalidateQueries({queryKey: queryKeys.words})
      void queryClient.invalidateQueries({queryKey: queryKeys.trashWords})
      void queryClient.invalidateQueries({queryKey: queryKeys.topics})
      void queryClient.invalidateQueries({queryKey: queryKeys.topicSidebar})
      void queryClient.invalidateQueries({queryKey: queryKeys.stats})
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
      setRestoreWordError((current) => (current?.id === restored.id ? null : current))
    },
    onError: (err: Error, wordId) => {
      setRestoreWordError({id: wordId, message: err.message})
    },
  })

  const restoreTopicMutation = useMutation({
    mutationFn: ({id, restoreWords}: {id: number; restoreWords: boolean}) => restoreTopic(id, restoreWords),
    onSuccess: (restored) => {
      queryClient.setQueryData<Topic[]>(queryKeys.trashTopics, (cur = []) => cur.filter((t) => t.id !== restored.id))
      void queryClient.invalidateQueries({queryKey: queryKeys.topics})
      void queryClient.invalidateQueries({queryKey: queryKeys.words})
      void queryClient.invalidateQueries({queryKey: queryKeys.trashTopics})
      void queryClient.invalidateQueries({queryKey: queryKeys.trashWords})
      void queryClient.invalidateQueries({queryKey: queryKeys.topicSidebar})
      void queryClient.invalidateQueries({queryKey: queryKeys.stats})
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
      setRestoreTopicId(null)
      setRestoreTopicError(null)
    },
    onError: (err: Error) => {
      setRestoreTopicError(err.message)
    },
  })

  const purgeMutation = useMutation({
    mutationFn: purgeTrash,
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: queryKeys.topics})
      void queryClient.invalidateQueries({queryKey: queryKeys.words})
      void queryClient.invalidateQueries({queryKey: queryKeys.trashWords})
      void queryClient.invalidateQueries({queryKey: queryKeys.trashTopics})
      void queryClient.invalidateQueries({queryKey: queryKeys.topicSidebar})
      void queryClient.invalidateQueries({queryKey: queryKeys.stats})
      void queryClient.invalidateQueries({queryKey: queryKeys.smartReview})
      setConfirmPurge(false)
    },
  })

  const words = wordsQuery.data ?? []
  const topics = topicsQuery.data ?? []
  const pendingRestoreTopic = topics.find((t) => t.id === restoreTopicId)

  function daysLeft(deletedAt: string) {
    const retention = settings?.trash_retention_days ?? 30
    return Math.max(0, retention - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000))
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
        <p className="trash-subtitle">Items are permanently deleted after {settings?.trash_retention_days ?? 30} days.</p>

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
                  onClick={() => {
                    setRestoreTopicId(topic.id)
                    setRestoreTopicError(null)
                  }}
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
                  <span className="trash-item-meta">{word.translations}</span>
                  <span className="trash-item-days">{daysLeft(word.deleted_at)} days left</span>
                  {restoreWordError?.id === word.id && (
                    <span className="login-error">{restoreWordError.message}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="trash-restore-btn"
                  onClick={() => {
                    setRestoreWordError((current) => (current?.id === word.id ? null : current))
                    restoreWordMutation.mutate(word.id)
                  }}
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
          onClose={() => {
            setRestoreTopicId(null)
            setRestoreTopicError(null)
          }}
        />
      )}
    </div>
  )
}
