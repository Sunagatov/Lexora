import {useEffect, useState} from 'react'
import {useNavigate, useLocation} from 'react-router-dom'
import {routes} from '@/app/routes'
import {ConfirmModal} from '@/shared/ui/ConfirmModal'
import {NotFoundPage} from '@/app/layout/NotFoundPage'
import {usePublicConfig} from '@/shared/config/usePublicConfig'
import {useWordPageState} from '@/features/words/hooks/useWordPageState'
import {WordPageEditForm} from '@/features/words/components/WordPageEditForm'
import {WordPageView} from '@/features/words/components/WordPageView'
import {WordPageFooterNav, WordPageHero, WordPageSkeleton} from '@/features/words/components/WordPageChrome'

export function WordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const s = useWordPageState({
    onSaveSuccess: (updated, locationState) => {
      navigate(routes.word(updated.id), {
        replace: true,
        state: locationState,
      })
    },
    onDeleteSuccess: (destinationTopicSlug) => {
      navigate(destinationTopicSlug ? routes.topic(destinationTopicSlug) : routes.home, {replace: true})
    },
  })
  const publicConfigQuery = usePublicConfig()
  const [isSpeaking, setIsSpeaking] = useState(false)

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  if (s.isInvalidWordId) return <NotFoundPage />
  if (s.isLoading) return <WordPageSkeleton />
  if (!s.word) return <div className="word-page-loading">Word not found.</div>

  const {word, topics, topic, draft, set, editing} = s
  const hasSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window
  const backRoute = topic?.slug
    ? routes.topic(topic.slug)
    : s.fromTopicSlug
      ? routes.topic(s.fromTopicSlug)
      : routes.home
  const trashRetentionDays = publicConfigQuery.data?.trash_retention_days ?? 30

  function handleSpeak() {
    if (!hasSpeechSynthesis || !word.term.trim()) return

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(word.term)
    utterance.lang = 'en-GB'
    utterance.rate = 0.92
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="word-page">
      <WordPageHero
        word={word}
        topicName={topic?.name}
        editing={editing}
        isSpeaking={isSpeaking}
        onBack={() => editing
          ? navigate(routes.word(s.wordId), {replace: true, state: location.state})
          : navigate(backRoute)}
        onEdit={() => navigate(routes.editWord(s.wordId), {state: location.state})}
        onSpeak={handleSpeak}
        hasSpeechSynthesis={hasSpeechSynthesis}
      />

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
        <WordPageFooterNav
          currentIndex={s.currentIdx}
          totalWords={s.topicWords.length}
          hasPrev={!!s.prevWord}
          hasNext={!!s.nextWord}
          onPrev={() => s.prevWord && navigate(routes.word(s.prevWord.id), {state: location.state})}
          onNext={() => s.nextWord && navigate(routes.word(s.nextWord.id), {state: location.state})}
        />
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
