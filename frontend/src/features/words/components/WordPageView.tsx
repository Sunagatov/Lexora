import {LEVEL_LABELS} from '@/features/words/model/wordDomain'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {Word} from '@/features/words/types/wordTypes'

type Props = {
  word: Word
  topics: Topic[]
}

export function WordPageView({word, topics}: Props) {
  const translationsToView = word.translation_entries?.length
    ? word.translation_entries.join('\n')
    : word.translations
  const examplesToView = word.example_entries?.length
    ? word.example_entries.join('\n')
    : word.example
  const topicNames = topics
    .filter((topic) => word.topic_ids.includes(topic.id))
    .map((topic) => topic.name)
    .join(', ')

  return (
    <div className="word-page-view">
      <ViewRow label="Translations" value={translationsToView} preserveLines />
      <ViewRow label="Part of speech" value={word.part_of_speech ?? '—'} />
      <ViewRow label="Topics" value={topicNames || '—'} />
      <ViewRow label="Knowledge" value={word.knowledge_level ? `${word.knowledge_level} — ${LEVEL_LABELS[word.knowledge_level]}` : '—'} />
      {word.countability && <ViewRow label="Countability" value={word.countability} />}
      {word.example_entries?.length ? (
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
      {word.past_simple && <ViewRow label="Past simple" value={word.past_simple} />}
      {word.past_participle && <ViewRow label="Past participle" value={word.past_participle} />}
      <ViewRow label="Updated" value={new Date(word.updated_at).toLocaleDateString()} />
      <ViewRow label="Created" value={new Date(word.created_at).toLocaleDateString()} />
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
