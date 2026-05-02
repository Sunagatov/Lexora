import {LEVEL_LABELS} from '@/features/words/model/wordDomain'
import type {Topic} from '@/features/topics/types/topicTypes'
import type {Word} from '@/features/words/types/wordTypes'

type Props = {
  word: Word
  topics: Topic[]
  hideTranslation?: boolean
  hidePOS?: boolean
}

const CEFR_CLASS: Record<string, string> = {
  A1: 'cefr-badge-a', A2: 'cefr-badge-a',
  B1: 'cefr-badge-b1', B2: 'cefr-badge-b2',
  C1: 'cefr-badge-c1', C2: 'cefr-badge-c2',
}

export function WordPageView({word, topics, hideTranslation = false, hidePOS = false}: Props) {
  const wordTopics = topics.filter((t) => word.topic_ids.includes(t.id))
  const hasSynonyms = word.synonym_entries.length > 0
  const hasAntonyms = word.antonym_entries.length > 0
  const hasCollocations = word.collocation_entries.length > 0
  const hasRelated = hasSynonyms || hasAntonyms || hasCollocations

  return (
    <div className="word-page-view">
      {/* Definition */}
      {word.definition && (
        <section className="wpv-section">
          <h3 className="wpv-section-title">Definition</h3>
          <p className="wpv-definition">{word.definition}</p>
        </section>
      )}

      {/* Pronunciation */}
      {word.pronunciation_ipa && (
        <section className="wpv-section">
          <h3 className="wpv-section-title">Pronunciation</h3>
          <span className="wpv-ipa-badge">/{word.pronunciation_ipa}/</span>
        </section>
      )}

      {/* Translations */}
      {!hideTranslation && word.translation_entries.length > 0 && (
        <section className="wpv-section">
          <h3 className="wpv-section-title">Translations</h3>
          <ol className="wpv-numbered-list">
            {word.translation_entries.map((t, i) => <li key={i}>{t}</li>)}
          </ol>
        </section>
      )}

      {/* Grammar */}
      {(word.part_of_speech || word.countability || word.pattern || word.register) && (
        <section className="wpv-section">
          <h3 className="wpv-section-title">Grammar</h3>
          <div className="wpv-grammar-grid">
            {!hidePOS && word.part_of_speech && <GrammarCell label="Part of speech" value={word.part_of_speech} />}
            {word.cefr_level && (
              <div className="wpv-grammar-cell">
                <span className="wpv-grammar-label">CEFR</span>
                <span className={`wpv-cefr-badge ${CEFR_CLASS[word.cefr_level] ?? ''}`}>{word.cefr_level}</span>
              </div>
            )}
            {word.countability && <GrammarCell label="Countability" value={word.countability} />}
            {word.register && <GrammarCell label="Register" value={word.register} />}
            {word.pattern && <GrammarCell label="Pattern" value={word.pattern} />}
          </div>
        </section>
      )}

      {/* Verb forms */}
      {word.verb_form && (word.verb_form.past_simple || word.verb_form.past_participle || word.verb_form.present_participle || word.verb_form.third_person) && (
        <section className="wpv-section">
          <h3 className="wpv-section-title">Verb Forms</h3>
          <div className="wpv-verb-grid">
            {word.verb_form.past_simple && <VerbCell label="Past simple" value={word.verb_form.past_simple} />}
            {word.verb_form.past_participle && <VerbCell label="Past participle" value={word.verb_form.past_participle} />}
            {word.verb_form.present_participle && <VerbCell label="Present participle" value={word.verb_form.present_participle} />}
            {word.verb_form.third_person && <VerbCell label="Third person" value={word.verb_form.third_person} />}
          </div>
        </section>
      )}

      {/* Knowledge */}
      {word.knowledge_level && (
        <section className="wpv-section">
          <h3 className="wpv-section-title">Knowledge</h3>
          <span className="wpv-grammar-value">L{word.knowledge_level} — {LEVEL_LABELS[word.knowledge_level]}</span>
        </section>
      )}

      {/* Examples */}
      {word.example_entries.length > 0 && (
        <section className="wpv-section">
          <h3 className="wpv-section-title">Examples</h3>
          <ol className="word-page-examples-list">
            {word.example_entries.map((ex, i) => <li key={i}>{ex}</li>)}
          </ol>
        </section>
      )}

      {/* Related words */}
      {hasRelated && (
        <section className="wpv-section">
          <h3 className="wpv-section-title">Related Words</h3>
          {hasSynonyms && <ChipGroup label="Synonyms" items={word.synonym_entries} />}
          {hasAntonyms && <ChipGroup label="Antonyms" items={word.antonym_entries} />}
          {hasCollocations && <ChipGroup label="Collocations" items={word.collocation_entries} />}
        </section>
      )}

      {/* Confusables */}
      {word.confusable_entries.length > 0 && (
        <section className="wpv-section">
          <h3 className="wpv-section-title">Confusables</h3>
          <div className="wpv-confusables">
            {word.confusable_entries.map((c, i) => (
              <div key={i} className="wpv-confusable-card">
                <span className="wpv-confusable-word">{c.value}</span>
                {c.explanation && <span className="wpv-confusable-explanation">{c.explanation}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      {word.notes && (
        <section className="wpv-section">
          <h3 className="wpv-section-title">Notes</h3>
          <p className="wpv-notes">{word.notes}</p>
        </section>
      )}

      {/* Topics */}
      {wordTopics.length > 0 && (
        <section className="wpv-section">
          <h3 className="wpv-section-title">Topics</h3>
          <div className="wpv-chip-row">
            {wordTopics.map((t) => <span key={t.id} className="wpv-topic-chip">{t.name}</span>)}
          </div>
        </section>
      )}

      {/* Timestamps */}
      <div className="word-page-view-timestamps">
        <span>Updated {new Date(word.updated_at).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})}</span>
        <span className="word-page-view-timestamps-sep">·</span>
        <span>Added {new Date(word.created_at).toLocaleDateString('en-GB', {day: 'numeric', month: 'short', year: 'numeric'})}</span>
      </div>
    </div>
  )
}

function GrammarCell({label, value}: {label: string; value: string}) {
  return (
    <div className="wpv-grammar-cell">
      <span className="wpv-grammar-label">{label}</span>
      <span className="wpv-grammar-value">{value}</span>
    </div>
  )
}

function VerbCell({label, value}: {label: string; value: string}) {
  return (
    <div className="wpv-verb-cell">
      <span className="wpv-verb-label">{label}</span>
      <span className="wpv-verb-value">{value}</span>
    </div>
  )
}

function ChipGroup({label, items}: {label: string; items: string[]}) {
  return (
    <div className="wpv-chip-group">
      <span className="wpv-chip-group-label">{label}</span>
      <div className="wpv-chip-row">
        {items.map((item, i) => <span key={i} className="wpv-related-chip">{item}</span>)}
      </div>
    </div>
  )
}
