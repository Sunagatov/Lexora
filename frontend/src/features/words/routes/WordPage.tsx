import {useNavigate, useLocation} from 'react-router-dom'
import {routes} from '@/app/routes'
import {levelClass} from '@/features/words/model/wordDomain'
import {ConfirmModal} from '@/shared/ui/ConfirmModal'
import {NotFoundPage} from '@/app/layout/NotFoundPage'
import {usePublicConfig} from '@/shared/config/usePublicConfig'
import {useWordPageState} from '@/features/words/hooks/useWordPageState'
import {WordPageEditForm} from '@/features/words/components/WordPageEditForm'
import {WordPageView} from '@/features/words/components/WordPageView'

export function WordPage() {
  const s = useWordPageState()
  const publicConfigQuery = usePublicConfig()
  const navigate = useNavigate()
  const location = useLocation()

  if (s.isInvalidWordId) return <NotFoundPage />
  if (s.isLoading) return <div className="word-page-loading">Loading…</div>
  if (!s.word) return <div className="word-page-loading">Word not found.</div>

  const {word, topics, topic, draft, set, editing} = s
  const lc = levelClass(word.knowledge_level)
  const backRoute = topic?.slug
    ? routes.topic(topic.slug)
    : s.fromTopicSlug
      ? routes.topic(s.fromTopicSlug)
      : routes.home
  const trashRetentionDays = publicConfigQuery.data?.trash_retention_days ?? 30

  return (
    <div className="word-page">

      <div className="word-page-hero-wrap">
        <div className="word-page-topbar">
          <button
            type="button"
            className="word-page-back-btn"
            onClick={() => editing
              ? navigate(routes.word(s.wordId), {replace: true, state: location.state})
              : navigate(backRoute)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12" />
            </svg>
            Back
          </button>
          {!editing && (
            <button type="button" className="word-page-edit-btn" onClick={() => navigate(routes.editWord(s.wordId), {state: location.state})}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>
        <div className={`word-page-hero ${lc}`}>
          <h1 className="word-page-term">{word.term}</h1>
        </div>
      </div>

      <div className="word-page-inner">
        {!editing && <WordPageView word={word} topics={topics} />}

        {editing && draft && (
          <WordPageEditForm
            draft={draft}
            topics={topics}
            saveError={s.saveError}
            savePending={s.savePending}
            onFieldChange={set}
            onClearError={() => s.setSaveError(null)}
            onDelete={() => s.setConfirming(true)}
            onCancel={() => {
              navigate(routes.word(s.wordId), {replace: true, state: location.state})
              s.setSaveError(null)
            }}
            onSave={s.save}
          />
        )}
      </div>

      {!editing && (
        <div className="word-page-footer">
          <button type="button" className="word-page-nav-btn" disabled={!s.prevWord} onClick={() => s.prevWord && navigate(routes.word(s.prevWord.id), {state: location.state})}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,2 4,7 9,12" /></svg>
            Prev
          </button>
          <span className="word-page-nav-pos">{s.currentIdx >= 0 ? `${s.currentIdx + 1} / ${s.topicWords.length}` : ''}</span>
          <button type="button" className="word-page-nav-btn word-page-nav-btn-next" disabled={!s.nextWord} onClick={() => s.nextWord && navigate(routes.word(s.nextWord.id), {state: location.state})}>
            Next
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="5,2 10,7 5,12" /></svg>
          </button>
        </div>
      )}

      {s.confirming && (
        <ConfirmModal
          title="Move to Trash?"
          message={`"${word.term}" will be moved to Trash and permanently deleted after ${trashRetentionDays} days.`}
          confirmLabel="Move to Trash"
          danger
          pending={s.deletePending}
          onConfirm={s.handleDelete}
          onCancel={() => s.setConfirming(false)}
        />
      )}
    </div>
  )
}
