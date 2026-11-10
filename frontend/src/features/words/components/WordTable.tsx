import {languageProfile} from '@/features/languages/api'
import {FavoriteButton} from './FavoriteButton'
import {usePreferences} from '@/features/preferences/api'
import {useLayoutEffect, useRef, useState} from 'react'
import {Link} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {routes} from '@/app/routes'
import {LEVEL_LABELS, LEVEL_TIPS, levelClass} from '@/features/words/model/wordDomain'
import {LevelDropdown} from '@/features/words/components/LevelDropdown'
import {WordSummaryContent} from '@/features/words/components/WordSummaryContent'
import {EasyPronunciation} from './EasyPronunciation'
import {pronunciationText, usePronunciationMode} from '@/features/words/model/pronunciation'
import {useWordListNavigation, type WordListContext} from '@/features/words/hooks/useWordListNavigation'
import {WordActionsMenu} from './WordActionsMenu'

type Props = {
  words: Word[]
  wordList?: WordListContext
  pendingWordId: number | null
  pendingWordIds?: ReadonlySet<number>
  fromTopicSlug?: string
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
  onWordSelect?: (id: number) => void
  selectedWordId?: number | null
}

export function WordTable({words, wordList, pendingWordId, pendingWordIds, fromTopicSlug, onUpdate, onWordSelect, selectedWordId}: Props) {
  const navigation = useWordListNavigation(fromTopicSlug, wordList)
  const readingMode = usePronunciationMode(words[0]?.language ?? 'en')
  const preferences = usePreferences()
  const hasPronunciation = preferences.pronunciation && words.some(word => pronunciationText(word, readingMode))
  const tableWrapRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  const separatePronunciation = hasPronunciation && !compact
  const [openId,     setOpenId]     = useState<number | null>(null)
  const [levelAnchor, setLevelAnchor] = useState<HTMLElement | null>(null)
  const [speakingId, setSpeakingId] = useState<number | null>(null)

  useLayoutEffect(() => {
    const element = tableWrapRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width <= 900))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function speak(id: number, term: string) {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(term)
    u.lang = languageProfile().locale
    u.rate = 0.92
    u.onstart = () => setSpeakingId(id)
    u.onend = () => setSpeakingId(null)
    u.onerror = () => setSpeakingId(null)
    window.speechSynthesis.speak(u)
  }

  return (
    <div ref={tableWrapRef} className="word-table-wrap">
      <table className={`word-table${separatePronunciation ? ' has-pronunciation' : ''}${compact ? ' is-compact' : ''}`} aria-label="Topic words table">
        <thead><tr>
          <th scope="col" className="word-cell-word">Word</th>
          {separatePronunciation && <th scope="col" className="word-cell-pronunciation">Pronunciation</th>}
          <th scope="col">Translation / details</th>
          <th scope="col" className="word-cell-knowledge">Knowledge</th>
        </tr></thead>
        <tbody>
          {words.map((word) => {
            const lc         = levelClass(word.knowledge_level)
            const isOpen     = openId === word.id

            return (
                <tr
                  key={word.id}
                  className={`word-row ${lc}${selectedWordId === word.id ? ' word-row-panel-active' : ''}${onWordSelect ? ' word-row-clickable' : ''}`}
                  onClick={onWordSelect ? () => onWordSelect(word.id) : undefined}
                >
                  <td className="word-cell-word">
                    <span className="word-table-term">
                    {onWordSelect ? (
                      <button type="button" className="word-term word-term-link word-table-open" onClick={event => {event.stopPropagation(); onWordSelect(word.id)}}>
                        <bdi lang={word.language} dir={word.language === 'ar' ? 'rtl' : 'ltr'}>{word.term}</bdi>
                      </button>
                    ) : (
                      <Link className="word-term word-term-link" to={routes.word(word.id)} state={navigation.state} onClick={event => navigation.openWord(event, word.id)}>
                        <bdi lang={word.language} dir={word.language === 'ar' ? 'rtl' : 'ltr'}>{word.term}</bdi>
                      </Link>
                    )}
                    <button type="button"
                      className={`wdp-speak-btn ripple-btn${speakingId === word.id ? ' is-speaking' : ''}`}
                      style={{marginLeft: 0}}
                      onClick={(e) => { e.stopPropagation(); speak(word.id, word.term) }}
                      aria-label={`Pronounce ${word.term}`}>
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h3l4-3v10l-4-3H3z"/>
                        {speakingId === word.id ? <path d="M11 6.5a2.5 2.5 0 0 1 0 3"/> : <path d="M12.2 5.2a4 4 0 0 1 0 5.6"/>}
                      </svg>
                    </button>
                    </span>
                    {hasPronunciation && compact && <span className="word-inline-pronunciation"><EasyPronunciation word={word} /></span>}
                  </td>
                  {separatePronunciation && <td className="word-cell-pronunciation"><EasyPronunciation word={word} /></td>}
                  <td className="word-cell-details">
                    <WordSummaryContent word={word} />
                  </td>
                  <td className="word-cell-knowledge">
                    <div className="word-level-wrap">
                      <div className="level-badge-wrap">
                        <button type="button" className={`level-badge level-badge-btn ${lc}`}
                          aria-haspopup="dialog" aria-expanded={isOpen}
                          disabled={pendingWordIds?.has(word.id) || pendingWordId === word.id}
                          onClick={(e) => { e.stopPropagation(); if (isOpen) { setOpenId(null); return } setLevelAnchor(e.currentTarget); setOpenId(word.id) }}
                        >
                          {LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <polyline points="2,3.5 5,6.5 8,3.5" />
                          </svg>
                        </button>
                        <span className="level-badge-tip">{LEVEL_TIPS[word.knowledge_level ?? 0]}</span>
                      </div>
                      {isOpen && (
                        <LevelDropdown term={word.term} current={word.knowledge_level as WordKnowledgeLevel | null} anchor={levelAnchor!}
                          onSelect={(l) => { onUpdate(word.id, l); setOpenId(null) }}
                          onClose={() => setOpenId(null)} />
                      )}
                      <FavoriteButton word={word} />
                      <WordActionsMenu word={word} wordList={wordList} fromTopicSlug={fromTopicSlug} disabled={pendingWordIds?.has(word.id) || pendingWordId === word.id} />
                    </div>
                  </td>
                </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
