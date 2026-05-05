import {type ReactNode, useEffect, useState} from 'react'
import {Link} from 'react-router-dom'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'
import {routes} from '@/app/routes'
import {LEVEL_LABELS, levelClass} from '@/features/words/model/wordDomain'
import {LevelDropdown, openUpward} from '@/features/words/components/LevelDropdown'
import {WordSummaryContent} from '@/features/words/components/WordSummaryContent'
import {lexicalChips} from '@/features/words/model/wordPresenter'

type Props = {
  words: Word[]
  pendingWordId: number | null
  fromTopicSlug?: string
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
}

function listText(items: string[]) {
  return items.filter(Boolean).join(' · ')
}

function ExtraLine({label, children}: {label: string; children: ReactNode}) {
  return (
    <div className="word-extra">
      <strong>{label}:</strong> {children}
    </div>
  )
}

function WordCard({word, pendingWordId, fromTopicSlug, onUpdate}: {
  word: Word
  pendingWordId: number | null
  fromTopicSlug?: string
  onUpdate: (wordId: number, level: WordKnowledgeLevel) => void
}) {
  const [openLevel, setOpenLevel] = useState(false)
  const [flipUp, setFlipUp] = useState(false)
  const storageKey = `lexora.word-card.expanded.${word.id}`
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(storageKey) === 'true'
  })

  const lc = levelClass(word.knowledge_level)
  const chips = lexicalChips(word)
  const verbForms = word.verb_form ? [
    ['Past', word.verb_form.past_simple],
    ['Participle', word.verb_form.past_participle],
    ['-ing', word.verb_form.present_participle],
    ['3rd', word.verb_form.third_person],
  ].filter((entry): entry is [string, string] => !!entry[1]) : []
  const showDefinition = !!word.definition
  const showExample = word.example_entries.length > 0
  const showNotes = !!word.notes
  const showPattern = !!word.pattern
  const hasExpanded = (
    word.translation_entries.length > 2 ||
    showDefinition ||
    showExample ||
    showNotes ||
    showPattern ||
    !!word.pronunciation_ipa ||
    chips.length > 0 ||
    !!word.frequency_rank ||
    verbForms.length > 0 ||
    word.synonym_entries.length > 0 ||
    word.antonym_entries.length > 0 ||
    word.collocation_entries.length > 0 ||
    word.confusable_entries.length > 0
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(storageKey, String(expanded))
  }, [expanded, storageKey])

  return (
    <article className={`word-card ${lc}`}>
      <div className="word-card-header">
        <Link className="word-term word-term-link" to={routes.word(word.id)} state={{fromTopicSlug}}>
          {word.term}
        </Link>
        <div className="word-card-level-wrap">
          <button
            type="button"
            className={`level-badge level-badge-btn ${lc}`}
            disabled={pendingWordId === word.id}
            onClick={(e) => {
              e.stopPropagation()
              if (openLevel) {
                setOpenLevel(false)
                return
              }
              setFlipUp(openUpward(e.currentTarget))
              setOpenLevel(true)
            }}
          >
            {LEVEL_LABELS[word.knowledge_level ?? 0] ?? 'Unset'}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <polyline points="2,3.5 5,6.5 8,3.5" />
            </svg>
          </button>
          {openLevel && (
            <LevelDropdown
              current={word.knowledge_level as WordKnowledgeLevel | null}
              flipUp={flipUp}
              onSelect={(level) => {
                onUpdate(word.id, level)
                setOpenLevel(false)
              }}
              onClose={() => setOpenLevel(false)}
            />
          )}
        </div>
      </div>

      <Link className="word-card-body-tap" to={routes.word(word.id)} state={{fromTopicSlug}}>
        <WordSummaryContent word={word} />
      </Link>

      {expanded && (
        <div className="word-card-extras">
          {showExample && (
            <div className="word-extra">
              <strong>Examples:</strong>
              {word.example_entries.length > 1 ? (
                <ol className="word-extra-examples">
                  {word.example_entries.map((example, index) => <li key={index}>{example}</li>)}
                </ol>
              ) : (
                <span> {word.example_entries[0]}</span>
              )}
            </div>
          )}
          {showDefinition && <ExtraLine label="Definition">{word.definition}</ExtraLine>}
          {word.translation_entries.length > 2 && <ExtraLine label="More Translations">{listText(word.translation_entries.slice(1))}</ExtraLine>}
          {word.pronunciation_ipa && <ExtraLine label="IPA">{word.pronunciation_ipa}</ExtraLine>}
          {chips.length > 0 && <ExtraLine label="Grammar">{chips.map((chip) => chip.label).join(' · ')}</ExtraLine>}
          {word.frequency_rank && <ExtraLine label="Frequency">#{word.frequency_rank}</ExtraLine>}
          {verbForms.length > 0 && <ExtraLine label="Forms">{verbForms.map(([label, value]) => `${label}: ${value}`).join(' · ')}</ExtraLine>}
          {showPattern && <ExtraLine label="Pattern">{word.pattern}</ExtraLine>}
          {word.synonym_entries.length > 0 && <ExtraLine label="Synonyms">{listText(word.synonym_entries)}</ExtraLine>}
          {word.antonym_entries.length > 0 && <ExtraLine label="Antonyms">{listText(word.antonym_entries)}</ExtraLine>}
          {word.collocation_entries.length > 0 && <ExtraLine label="Collocations">{listText(word.collocation_entries)}</ExtraLine>}
          {word.confusable_entries.length > 0 && (
            <div className="word-extra">
              <strong>Confusables:</strong>
              <ol className="word-extra-examples">
                {word.confusable_entries.map((entry, index) => (
                  <li key={`${entry.value}-${index}`}>
                    {entry.value}{entry.explanation ? ` - ${entry.explanation}` : ''}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {showNotes && <ExtraLine label="Notes">{word.notes}</ExtraLine>}
        </div>
      )}

      {hasExpanded && (
        <div className="word-card-footer">
          <div />
          <button
            type="button"
            className={`word-card-expand-btn${expanded ? ' is-expanded' : ''}`}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? '−' : '+'}
          </button>
        </div>
      )}

    </article>
  )
}

export function WordCardList({words, pendingWordId, fromTopicSlug, onUpdate}: Props) {
  return (
    <div className="word-card-list">
      {words.map((word) => (
        <WordCard
          key={word.id}
          word={word}
          pendingWordId={pendingWordId}
          fromTopicSlug={fromTopicSlug}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  )
}
