import type {Word} from '@/features/words/types/wordTypes'
import {lexicalChips, smartPreview, truncate} from '@/features/words/model/wordPresenter'

type Props = {word: Word}

const CEFR_CLASS: Record<string, string> = {
  A1: 'chip-cefr-a', A2: 'chip-cefr-a',
  B1: 'chip-cefr-b1', B2: 'chip-cefr-b2',
  C1: 'chip-cefr-c1', C2: 'chip-cefr-c2',
}

export function WordSummaryContent({word}: Props) {
  const chips = lexicalChips(word)
  const preview = smartPreview(word)
  const translation = word.translation_entries.slice(0, 2).join(' · ')

  return (
    <>
      {chips.length > 0 && (
        <div className="word-chips">
          {chips.map((c) => (
            <span key={c.label} className={`chip ${c.type === 'cefr' ? CEFR_CLASS[c.label] ?? '' : ''} ${c.type === 'register' ? 'chip-register' : ''}`}>
              {c.label}
            </span>
          ))}
        </div>
      )}
      {translation && <div className="word-translation">{translation}</div>}
      {word.definition && <div className="word-definition-line">{truncate(word.definition, 80)}</div>}
      {preview && (
        <div className="word-preview-line">
          <span className="word-preview-label">{preview.label}:</span>
          <span className="word-preview-text">{preview.text}</span>
        </div>
      )}
    </>
  )
}
