import {languageProfile} from '@/features/languages/api'
import {useState} from 'react'
import type {CSSProperties} from 'react'
import {Link} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {routes} from '@/app/routes'
import {LEVEL_LABELS, levelClass} from '@/features/words/model/wordDomain'
import {LevelDropdown} from '@/features/words/components/LevelDropdown'
import {EasyPronunciation} from './EasyPronunciation'
import {lexicalChips} from '@/features/words/model/wordPresenter'
import {useWordListNavigation, type WordListContext} from '@/features/words/hooks/useWordListNavigation'
import {SWIPE_THRESHOLD, useWordSwipe} from '@/features/words/hooks/useWordSwipe'
import {FavoriteButton} from './FavoriteButton'
import {usePreferences} from '@/features/preferences/api'
import {WordActionsMenu} from './WordActionsMenu'

type UpdateLevel = (wordId: number, level: WordKnowledgeLevel) => void | Promise<boolean | void>

type Props = {
  words: Word[]
  wordList?: WordListContext
  pendingWordId: number | null
  pendingWordIds?: ReadonlySet<number>
  fromTopicSlug?: string
  onUpdate: UpdateLevel
  reviewMode?: boolean
}

function WordCard({word, wordList, pendingWordId, fromTopicSlug, onUpdate, onSwipe}: {
  word: Word
  wordList?: WordListContext
  pendingWordId: number | null
  fromTopicSlug?: string
  onUpdate: UpdateLevel
  onSwipe: (word: Word, level: 4 | 5) => void
}) {
  const [openLevel, setOpenLevel] = useState(false)
  const preferences = usePreferences()
  const [levelAnchor, setLevelAnchor] = useState<HTMLElement | null>(null)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const navigation = useWordListNavigation(fromTopicSlug, wordList)
  const {offset, ready, ...swipe} = useWordSwipe(level => onSwipe(word, level), !preferences.swipes || pendingWordId === word.id || openLevel)

  function speak(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(word.term)
    u.lang = languageProfile(word.language).locale
    u.rate = 0.92
    u.onstart = () => setIsSpeaking(true)
    u.onend = () => setIsSpeaking(false)
    u.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(u)
  }

  const lc = levelClass(word.knowledge_level)
  const translation = word.translation_entries.join(' · ')
  const chips = lexicalChips(word)
  const cefr = chips.find(chip => chip.type === 'cefr')
  const pos = chips.find(chip => chip.type === 'pos')

  return (
    <article {...swipe}
      style={{'--swipe-x': `${offset}px`, '--swipe-angle': `${offset / 30}deg`} as CSSProperties}
      className={`word-card ${lc}${openLevel ? ' word-card-dropdown-open' : ''}${offset ? ` swipe-dragging ${offset > 0 ? 'swipe-strong' : 'swipe-parked'}` : ''}`}>
      <div className="word-card-actions" data-word-swipe-actions>
        <button type="button"
          className={`word-card-speak${isSpeaking ? ' is-speaking' : ''}`}
          onClick={speak}
          aria-label={`Pronounce ${word.term}`}>
          <svg width="19" height="19" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h3l4-3v10l-4-3H3z"/>
            {isSpeaking ? <path d="M11 6.5a2.5 2.5 0 0 1 0 3"/> : <path d="M12.2 5.2a4 4 0 0 1 0 5.6"/>}
          </svg>
        </button>
        <FavoriteButton word={word} />
      </div>
      {offset !== 0 && <span className="swipe-feedback" style={{opacity: Math.min(Math.abs(offset) / SWIPE_THRESHOLD, .95)}} aria-hidden="true">{offset > 0 ? 'Strong →' : '← Parked'}{ready ? ' · Release' : ' · Keep swiping'}</span>}
      <Link className="word-card-body-tap" draggable={false} to={routes.word(word.id)} state={navigation.state} onClick={event => navigation.openWord(event, word.id)}>
        <span className="word-term"><bdi lang={word.language} dir={word.language === 'ar' ? 'rtl' : 'ltr'}>{word.term}</bdi></span>
        <EasyPronunciation word={word} />
        {translation && <span className="word-translation-focus word-card-translations">{translation}</span>}
      </Link>
      <div className="word-card-footer">
        {(cefr || pos) && <div className="word-summary-badges">
          {cefr && <span className={`header-badge header-badge-cefr header-badge-cefr-${cefr.label.toLowerCase()}`}>{cefr.label}</span>}
          {pos && <span className="header-badge header-badge-pos">{pos.label}</span>}
        </div>}
        <div className="word-card-level-wrap">
          <button
            type="button"
            className={`level-badge level-badge-btn ${lc}`}
            aria-haspopup="dialog" aria-expanded={openLevel}
            disabled={pendingWordId === word.id}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (openLevel) { setOpenLevel(false); return }
              setLevelAnchor(e.currentTarget)
              setOpenLevel(true)
            }}
          >
            {LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <polyline points="2,3.5 5,6.5 8,3.5" />
            </svg>
          </button>
          {openLevel && levelAnchor && (
            <LevelDropdown
              term={word.term}
              current={word.knowledge_level as WordKnowledgeLevel | null}
              anchor={levelAnchor}
              onSelect={(level) => { onUpdate(word.id, level); setOpenLevel(false) }}
              onClose={() => setOpenLevel(false)}
            />
          )}
          <WordActionsMenu word={word} wordList={wordList} fromTopicSlug={fromTopicSlug} disabled={pendingWordId === word.id} />
        </div>
      </div>
    </article>
  )
}

export function WordCardList({words, wordList, pendingWordId, pendingWordIds, fromTopicSlug, onUpdate, reviewMode = false}: Props) {
  async function swipe(word: Word, level: 4 | 5) {
    if (word.knowledge_level === level && !reviewMode) return
    try { await onUpdate(word.id, level) }
    catch { return } // The list owns the visible save error and rollback.
  }
  return (
    <div className="word-card-list">
      {words.map((word) => (
        <WordCard
          key={word.id}
          word={word}
          wordList={wordList}
          pendingWordId={pendingWordIds?.has(word.id) ? word.id : pendingWordId}
          fromTopicSlug={fromTopicSlug}
          onUpdate={onUpdate}
          onSwipe={swipe}
        />
      ))}
    </div>
  )
}
