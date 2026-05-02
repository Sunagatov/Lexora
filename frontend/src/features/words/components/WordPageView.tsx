import {LEVEL_LABELS} from '@/features/words/model/wordDomain'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {Word} from '@/features/words/types/wordTypes'

type Props = {
  word: Word
  topics: Topic[]
  hideTranslation?: boolean
  hidePOS?: boolean
}

export function WordPageView({word, topics, hideTranslation = false, hidePOS = false}: Props) {
  const translationsToView = word.translation_entries.join('\n')
  const examplesToView = word.example_entries.join('\n')
  const topicNames = topics
    .filter((topic) => word.topic_ids.includes(topic.id))
    .map((topic) => topic.name)
    .join(', ')

  return (
    <div className="word-page-view">
      {!hideTranslation && <ViewRow label="Translations" value={translationsToView || '—'} preserveLines />}
      {!hidePOS && <ViewRow label="Part of speech" value={word.part_of_speech ?? '—'} />}
      <ViewRow label="Topics" value={topicNames || '—'} />
      <ViewRow label="Knowledge" value={word.knowledge_level ? `${word.knowledge_level} — ${LEVEL_LABELS[word.knowledge_level]}` : '—'} />
      {word.countability && <ViewRow label="Countability" value={word.countability} />}
      {word.example_entries.length ? (
        <div className="word-page-view-row">
          <span className="word-page-view-label">Examples</span>
          <ol className="word-page-examples-list">
            {word.example_entries.map((example, index) => <li key={index}>{example}</li>)}
          </ol>
        </div>
      ) : examplesToView ? (
        <ViewRow label="Examples" value={examplesToView} preserveLines />
      ) : null}
      {word.notes && <ViewRow label="Notes" value={word.notes} preserveLines />}
      {word.pattern && <ViewRow label="Pattern" value={word.pattern} preserveLines />}
      {word.verb_form?.past_simple && <ViewRow label="Past simple" value={word.verb_form.past_simple} />}
      {word.verb_form?.past_participle && <ViewRow label="Past participle" value={word.verb_form.past_participle} />}
      <div className="word-page-view-timestamps">
        <span>Updated {new Date(word.updated_at).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})}</span>
        <span className="word-page-view-timestamps-sep">·</span>
        <span>Added {new Date(word.created_at).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})}</span>
      </div>
    </div>
  )
}

function ViewRow({label, value, preserveLines = false}: {label: string; value: string; preserveLines?: boolean}) {
  return (
    <div className="word-page-view-row">
      <span className="word-page-view-label">{label}</span>
      <span className="word-page-view-value" style={preserveLines ? {whiteSpace: 'pre-wrap'} : undefined}>
        {value}
      </span>
    </div>
  )
}
