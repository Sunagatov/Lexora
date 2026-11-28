import {useEffect, useRef, useState} from 'react'
import type {Word} from '@/features/words/types/wordTypes'
import '@/features/smart-review/swipe.css'

type Outcome = {wordId: number; recalled: boolean; occurredAt: string}

export function RecallPractice({words, onClose, recordOutcome}: {
  words: Word[]
  onClose: () => void
  recordOutcome: (wordId: number, recalled: boolean, occurredAt: string) => Promise<void>
}) {
  const cards = words.filter(word => word.translation_entries.length > 0).slice(0, 10)
  const [score, setScore] = useState({completed: 0, recalled: 0})
  const [revealed, setRevealed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState<Outcome | null>(null)
  const inFlight = useRef(false)
  const primaryAction = useRef<HTMLButtonElement>(null)
  const word = cards[score.completed]

  useEffect(() => {
    primaryAction.current?.focus({preventScroll: true})
  }, [score.completed, revealed, failed])

  async function save(outcome: Outcome) {
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    try {
      await recordOutcome(outcome.wordId, outcome.recalled, outcome.occurredAt)
      setScore(current => ({
        completed: current.completed + 1,
        recalled: current.recalled + Number(outcome.recalled),
      }))
      setRevealed(false)
      setFailed(null)
    } catch {
      setFailed(outcome)
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  if (!word) return (
    <section className="mix-finished" aria-label="Recall practice" aria-live="polite">
      <h3>{cards.length ? 'Recall practice complete' : 'No translations to practice'}</h3>
      {cards.length > 0 && <p>{score.recalled} of {score.completed} recalled</p>}
      <button ref={primaryAction} type="button" className="mix-secondary" onClick={onClose}>Done</button>
    </section>
  )

  function answer(recalled: boolean) {
    if (!word || !revealed || failed) return
    void save({wordId: word.id, recalled, occurredAt: new Date().toISOString()})
  }

  return (
    <section aria-label="Recall practice" aria-busy={saving}>
      <div className="stats-entry-pagination">
        <span role="status">Word {score.completed + 1} of {cards.length}</span>
        <button type="button" className="word-page-back-btn" onClick={onClose} disabled={saving}>End practice</button>
      </div>
      <div className="mix-card-stage">
        <article className="mix-card" data-swipes-disabled>
          <div className="mix-card-word">
            <h2><bdi lang={word.language} dir="auto">{word.term}</bdi></h2>
          </div>
          {revealed
            ? <p className="mix-translations" lang={word.translation_language} dir="auto">{word.translation_entries.join(' · ')}</p>
            : <p>Try to recall the translation before revealing it.</p>}
        </article>
      </div>
      {failed ? (
        <div className="mix-error" role="alert">
          Could not save your answer.
          <button ref={primaryAction} type="button" disabled={saving} onClick={() => { void save(failed) }}>Retry</button>
        </div>
      ) : revealed ? (
        <div className="stats-entry-pagination" role="group" aria-label="Did you recall the answer before revealing it?">
          <button ref={primaryAction} type="button" className="mix-action mix-strong" style={{flex: 1, justifyContent: 'center'}}
            disabled={saving} onClick={() => answer(true)}>Recalled</button>
          <button type="button" className="mix-action mix-skip" style={{flex: 1, justifyContent: 'center'}}
            disabled={saving} onClick={() => answer(false)}>Missed</button>
        </div>
      ) : (
        <button ref={primaryAction} type="button" className="word-page-back-btn" onClick={() => setRevealed(true)}>Reveal answer</button>
      )}
    </section>
  )
}
