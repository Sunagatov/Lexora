import type {Word} from '@/features/words/types/wordTypes'
import {lexicalChips} from '@/features/words/model/wordPresenter'

type Props = {word: Word}

export function WordSummaryContent({word}: Props) {
  const chips = lexicalChips(word)
  const cefr = chips.find((c) => c.type === 'cefr')
  const pos  = chips.find((c) => c.type === 'pos')
  const translation = word.translation_entries[0]

  return (
    <div className="word-summary-row">
      <div className="word-summary-main">
        {translation && <span className="word-translation-focus">{translation}</span>}
      </div>
      {(cefr || pos) && (
        <div className="word-summary-badges">
          {cefr && <span className={`header-badge header-badge-cefr header-badge-cefr-${cefr.label.toLowerCase()}`}>{cefr.label}</span>}
          {pos  && <span className="header-badge header-badge-pos">{pos.label}</span>}
        </div>
      )}
    </div>
  )
}
