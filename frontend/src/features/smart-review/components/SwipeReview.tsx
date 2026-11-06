import {useEffect, useRef, useState} from 'react'
import type {CSSProperties} from 'react'
import {Link} from 'react-router-dom'
import type {StudyQueue} from '../types/studyQueueTypes'
import type {Word} from '@/features/words/types/wordTypes'
import {languageProfile, languagePreferences} from '@/features/languages/api'
import {LEVEL_LABELS} from '@/features/words/model/wordDomain'
import {EasyPronunciation} from '@/features/words/components/EasyPronunciation'
import {usePreferences} from '@/features/preferences/api'
import {routes} from '@/app/routes'
import {useSwipeSession} from '../hooks/useSwipeSession'
import {useMixSwipe} from '../hooks/useMixSwipe'
import {SWIPE_DISTANCE, type SwipeRating} from '../model/swipeSession'
import '../swipe.css'

const ACTIONS = [
  {value: 5, label: 'Parked', arrow: '←', className: 'parked'},
  {value: 3, label: 'Okay', arrow: '↑', className: 'okay'},
  {value: 'skip', label: 'Skip', arrow: '↓', className: 'skip'},
  {value: 4, label: 'Strong', arrow: '→', className: 'strong'},
] as const

function PronounceButton({word}: {word: Word}) {
  const audio = useRef<HTMLAudioElement | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => () => {
    audio.current?.pause()
    window.speechSynthesis?.cancel()
  }, [])
  function play() {
    setError(false)
    if (word.pronunciation_audio_url) {
      audio.current?.pause()
      audio.current = new Audio(word.pronunciation_audio_url)
      void audio.current.play().catch(() => setError(true))
    } else if (window.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(word.term)
      utterance.lang = languageProfile(word.language).locale
      utterance.rate = .92
      utterance.onerror = () => setError(true)
      window.speechSynthesis.speak(utterance)
    } else setError(true)
  }
  return <div className="mix-audio">
    <button type="button" onClick={play} aria-label={`Pronounce ${word.term}`}>
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M4 9h4l5-5v16l-5-5H4zM16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14" />
      </svg>
    </button>
    {error && <span role="status">Audio unavailable</span>}
  </div>
}

export function SwipeReview({queue, onBackToList, onBusyChange}: {queue: StudyQueue; onBackToList: () => void; onBusyChange: (busy: boolean) => void}) {
  const language = queue.items[0]?.word.language ?? languagePreferences().language
  const preferences = usePreferences()
  const s = useSwipeSession(queue, language)
  const {session, item} = s
  useEffect(() => {
    onBusyChange(s.blocked)
    return () => onBusyChange(false)
  }, [s.blocked, onBusyChange])
  function act(action: SwipeRating | 'skip') {
    if (action === 'skip') s.skip()
    else void s.rate(action)
  }
  const swipe = useMixSwipe(act, s.blocked || !preferences.swipes || !item)
  const distance = Math.max(Math.abs(swipe.drag.x), Math.abs(swipe.drag.y))
  const direction = Math.abs(swipe.drag.x) > Math.abs(swipe.drag.y) ? (swipe.drag.x > 0 ? 4 : 5) : (swipe.drag.y > 0 ? 'skip' : 3)
  const preview = ACTIONS.find(action => action.value === direction)!
  const hasDrag = distance > 10
  const skipped = queue.items.filter(entry => session.decisions[entry.id] === 'skip').map(entry => entry.id)
  const unvisited = queue.items.filter(entry => !session.decisions[entry.id] && !entry.is_completed).map(entry => entry.id)
  const finished = !item
  const position = finished ? session.order.length : session.cursor + 1

  return <section className="mix-swipe" aria-label="Daily Word Mix swipe review" aria-busy={s.busy}>
    <div className="mix-position">
      <progress aria-label="Mix position" value={position} max={session.order.length || 1} />
      <span aria-live="polite">{position} / {session.order.length}</span>
    </div>
    <p className="mix-resume">Your place is saved on this device</p>
    {(s.error || s.hasRecovery) && <div className="mix-error" role="alert">
      {s.error || 'Your rating was saved. Retry to finish saving review progress.'}
      <button type="button" disabled={s.busy} onClick={s.retry}>Retry</button>
    </div>}
    {queue.items.length === 0 ? <div className="mix-finished"><h2>No words in this mix</h2><p>Create a new set or adjust your Daily Word Mix settings.</p><button type="button" onClick={onBackToList}>Back to word mix</button></div>
      : finished ? <div className="mix-finished">
        <div className="mix-finished-check" aria-hidden="true">✓</div>
        <h2>{unvisited.length ? 'End of this pass' : 'Mix complete'}</h2>
        <p>A little practice, every day.</p>
        <dl className="mix-results">
          {([4, 3, 5] as const).map(level => <div key={level} className={`mix-result-${level}`}><dt>{LEVEL_LABELS[level]}</dt><dd>{Object.values(session.decisions).filter(value => value === level).length}</dd></div>)}
        </dl>
        {skipped.length > 0 && <>
          <p className="mix-skipped-note">{skipped.length} skipped · Knowledge unchanged</p>
          <button type="button" className="mix-primary" onClick={() => s.revisit(skipped)}>Review skipped ({skipped.length})</button>
        </>}
        {unvisited.length > 0 && <button type="button" className="mix-primary" onClick={() => s.revisit(unvisited)}>Review remaining ({unvisited.length})</button>}
        <button type="button" className="mix-secondary" onClick={onBackToList}>Back to word mix</button>
      </div> : <>
        <div className="mix-card-stage">
          <article className={`mix-card${hasDrag ? ` is-dragging mix-${preview.className}` : ''}`}
            style={{'--mix-x': `${Math.max(-135, Math.min(135, swipe.drag.x))}px`, '--mix-y': `${Math.max(-100, Math.min(100, swipe.drag.y))}px`, '--mix-angle': `${Math.max(-7, Math.min(7, swipe.drag.x / 25))}deg`} as CSSProperties}>
            <div className="mix-card-top"><span>{languageProfile(item.word.language).name}</span><PronounceButton key={item.id} word={item.word} /></div>
            <div className="mix-card-word" {...swipe.events} aria-label="Swipe word card">
              <div className="mix-card-meta">{[item.word.part_of_speech, item.word.cefr_level].filter(Boolean).join(' · ')}</div>
              <h2><bdi lang={item.word.language} dir={item.word.language === 'ar' ? 'rtl' : 'ltr'}>{item.word.term}</bdi></h2>
              <EasyPronunciation word={item.word} />
              <div className="mix-translations" lang={item.word.translation_language ?? 'ru'}>
                {item.word.translation_entries.length ? item.word.translation_entries.join(' · ') : 'No translation saved'}
              </div>
              <span className="mix-gesture-hint">{preferences.swipes ? 'Swipe here or use the buttons below' : 'Use the buttons below to review'}</span>
            </div>
            {item.word.example_entries[0] && <div className="mix-card-example" tabIndex={0} aria-label="Example, scroll for more">
              <span>Example</span><p>{item.word.example_entries[0]}</p>
            </div>}
            <div className="mix-card-footer"><span>{LEVEL_LABELS[item.word.knowledge_level ?? 0] ?? 'Not rated'}</span><Link to={routes.word(item.word_id)}>Word details ↗</Link></div>
            {hasDrag && <div className="mix-swipe-preview" aria-live="polite">{preview.arrow} {preview.label}<small>{swipe.action !== null ? 'Release to apply' : 'Keep swiping · Move back to cancel'}</small></div>}
          </article>
        </div>
        <div className="mix-swipe-threshold" aria-hidden="true"><span style={{width: `${Math.min(100, distance / SWIPE_DISTANCE * 100)}%`}} /></div>
        <div className="mix-actions" aria-label="Rate or skip this word">
          {ACTIONS.map(action => <button type="button" key={action.label} className={`mix-action mix-${action.className}`} disabled={s.blocked}
            aria-label={action.label === 'Skip' ? 'Skip for now' : `Mark ${action.label}`} onClick={() => act(action.value)}>
            <span aria-hidden="true">{action.arrow}</span>{action.label}
          </button>)}
        </div>
      </>}
    <nav className="mix-navigation" aria-label="Browse mix without rating">
      <button type="button" disabled={s.blocked || session.cursor === 0} onClick={() => s.navigate(session.cursor - 1)}><span aria-hidden="true">‹</span> Previous</button>
      <span>Browse</span>
      <button type="button" disabled={s.blocked || finished} onClick={() => s.navigate(session.cursor + 1)}>Next <span aria-hidden="true">›</span></button>
    </nav>
  </section>
}
