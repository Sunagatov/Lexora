import type {Word} from '../../shared/http'
import {lexicalChips, smartPreview} from './wordPresenter'

type Props = {word: Word}

export function WordSummaryContent({word}: Props) {
  const chips   = lexicalChips(word)
  const preview = smartPreview(word)
  return (
    <>
      {chips.length > 0 && (
        <div className="word-chips">{chips.map((c) => <span key={c} className="chip">{c}</span>)}</div>
      )}
      <div className="word-translation">{word.translations}</div>
      {preview && (
        <div className="word-preview-line">
          <span className="word-preview-label">{preview.label}:</span>
          <span className="word-preview-text">{preview.text}</span>
        </div>
      )}
    </>
  )
}
