import {useState} from 'react'
import type {ReactNode} from 'react'
import type {EditState} from '@/features/words/model/wordForm'
import type {Topic} from '@/features/topics/types/topicTypes'

type Props = {
  draft: EditState
  topics: Topic[]
  saveError: string | null
  savePending: boolean
  enrichPending?: boolean
  onFieldChange: (field: keyof EditState, value: string | string[]) => void
  onClearError: () => void
  onDelete: () => void
  onCancel: () => void
  onSave: () => void
  onEnrich?: () => void
}

export function WordPageEditForm({
  draft,
  topics,
  saveError,
  savePending,
  enrichPending,
  onFieldChange,
  onClearError,
  onDelete,
  onCancel,
  onSave,
  onEnrich,
}: Props) {
  const [topicSearch, setTopicSearch] = useState('')
  const isVerb = draft.part_of_speech === 'verb' || draft.part_of_speech === 'phrasal verb'
  const isNoun = draft.part_of_speech === 'noun'
  const topicOptions = [...topics].sort((a, b) => a.name.localeCompare(b.name))
  const filteredTopicOptions = topicSearch.trim()
    ? topicOptions.filter((topic) => topic.name.toLowerCase().includes(topicSearch.trim().toLowerCase()))
    : topicOptions
  const selectedTopicIds = new Set(draft.topic_ids.map(Number).filter((value) => value > 0))

  function updateField(field: keyof EditState, value: string | string[]) {
    onFieldChange(field, value)
    onClearError()
  }

  function toggleTopic(topicId: number, checked: boolean) {
    const current = draft.topic_ids.map(Number).filter((value) => value > 0)
    const next = checked
      ? Array.from(new Set([...current, topicId])).map(String)
      : current.filter((id) => id !== topicId).map(String)
    onFieldChange('topic_ids', next)
  }

  return (
    <>
      <div className="word-page-edit-form">
        {onEnrich && (
          <div className="wp-enrich-row">
            <button type="button" className="wp-btn-enrich" disabled={enrichPending || !draft.term.trim()} onClick={onEnrich}>
              {enrichPending ? '✨ Enriching…' : '✨ Enrich with AI'}
            </button>
          </div>
        )}
        <FormField label="Term">
          <input className="wp-input" value={draft.term} maxLength={255} onChange={(event) => updateField('term', event.target.value)} />
        </FormField>
        <FormField label="Definition">
          <textarea className="wp-input wp-textarea" rows={2} value={draft.definition} onChange={(event) => updateField('definition', event.target.value)} />
        </FormField>
        <FormField label="Translations (one per line)">
          <textarea
            className="wp-input wp-textarea"
            rows={3}
            value={draft.translations}
            onChange={(event) => updateField('translations', event.target.value)}
          />
        </FormField>
        <div className="wp-row-2">
          <FormField label="Knowledge level">
            <select className="wp-input" value={draft.knowledge_level} onChange={(event) => onFieldChange('knowledge_level', event.target.value)}>
              <option value="">— not set —</option>
              <option value="1">1 — Weak</option>
              <option value="2">2 — Basic</option>
              <option value="3">3 — Okay</option>
              <option value="4">4 — Strong</option>
              <option value="5">5 — Parked</option>
            </select>
          </FormField>
          <FormField label="Part of speech">
            <select className="wp-input" value={draft.part_of_speech} onChange={(event) => onFieldChange('part_of_speech', event.target.value)}>
              <option value="">— not set —</option>
              <option value="noun">Noun</option>
              <option value="verb">Verb</option>
              <option value="adjective">Adjective</option>
              <option value="adverb">Adverb</option>
              <option value="phrase">Phrase</option>
              <option value="preposition">Preposition</option>
              <option value="phrasal verb">Phrasal verb</option>
              <option value="other">Other</option>
            </select>
          </FormField>
        </div>
        <div className="wp-row-2">
          <FormField label="CEFR level">
            <select className="wp-input" value={draft.cefr_level} onChange={(event) => onFieldChange('cefr_level', event.target.value)}>
              <option value="">— not set —</option>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
              <option value="C1">C1</option>
              <option value="C2">C2</option>
            </select>
          </FormField>
          <FormField label="Register">
            <select className="wp-input" value={draft.register} onChange={(event) => onFieldChange('register', event.target.value)}>
              <option value="">— not set —</option>
              <option value="formal">Formal</option>
              <option value="informal">Informal</option>
              <option value="neutral">Neutral</option>
              <option value="slang">Slang</option>
              <option value="technical">Technical</option>
            </select>
          </FormField>
        </div>
        <div className="wp-row-2">
          <FormField label="Pronunciation (IPA)">
            <input className="wp-input" value={draft.pronunciation_ipa} onChange={(event) => updateField('pronunciation_ipa', event.target.value)} />
          </FormField>
          <FormField label="Frequency rank">
            <input className="wp-input" type="number" min="1" value={draft.frequency_rank} onChange={(event) => updateField('frequency_rank', event.target.value)} />
          </FormField>
        </div>
        {isNoun && (
          <FormField label="Countability">
            <select className="wp-input" value={draft.countability} onChange={(event) => onFieldChange('countability', event.target.value)}>
              <option value="">— not set —</option>
              <option value="countable">Countable</option>
              <option value="uncountable">Uncountable</option>
              <option value="both">Both</option>
              <option value="plural">Plural</option>
              <option value="collective">Collective</option>
            </select>
          </FormField>
        )}
        {isVerb && (
          <div className="wp-row-2">
            <FormField label="Past simple">
              <input className="wp-input" value={draft.past_simple} onChange={(event) => onFieldChange('past_simple', event.target.value)} />
            </FormField>
            <FormField label="Past participle">
              <input className="wp-input" value={draft.past_participle} onChange={(event) => onFieldChange('past_participle', event.target.value)} />
            </FormField>
          </div>
        )}
        {isVerb && (
          <div className="wp-row-2">
            <FormField label="Present participle">
              <input className="wp-input" value={draft.present_participle} onChange={(event) => onFieldChange('present_participle', event.target.value)} />
            </FormField>
            <FormField label="Third person">
              <input className="wp-input" value={draft.third_person} onChange={(event) => onFieldChange('third_person', event.target.value)} />
            </FormField>
          </div>
        )}
        <FormField label="Topics">
          <input
            className="wp-input"
            value={topicSearch}
            placeholder="Filter topics"
            onChange={(event) => setTopicSearch(event.target.value)}
          />
          <div className="wp-topic-meta">
            <span>{selectedTopicIds.size} selected</span>
            <button
              type="button"
              className="wp-topic-clear"
              onClick={() => onFieldChange('topic_ids', [])}
              disabled={selectedTopicIds.size === 0}
            >
              Clear
            </button>
          </div>
          <div className="wp-topic-list">
            {filteredTopicOptions.length > 0 ? filteredTopicOptions.map((topic) => (
              <label key={topic.id} className={`wp-topic-option ${selectedTopicIds.has(topic.id) ? 'is-selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selectedTopicIds.has(topic.id)}
                  onChange={(event) => toggleTopic(topic.id, event.target.checked)}
                />
                <span>{topic.name}</span>
              </label>
            )) : (
              <div className="wp-topic-empty">No topics match.</div>
            )}
          </div>
        </FormField>
        <FormField label="Examples (one per line)">
          <textarea className="wp-input wp-textarea" rows={4} value={draft.example} onChange={(event) => onFieldChange('example', event.target.value)} />
        </FormField>
        <FormField label="Synonyms (one per line)">
          <textarea className="wp-input wp-textarea" rows={3} value={draft.synonyms} onChange={(event) => onFieldChange('synonyms', event.target.value)} />
        </FormField>
        <FormField label="Antonyms (one per line)">
          <textarea className="wp-input wp-textarea" rows={2} value={draft.antonyms} onChange={(event) => onFieldChange('antonyms', event.target.value)} />
        </FormField>
        <FormField label="Collocations (one per line)">
          <textarea className="wp-input wp-textarea" rows={3} value={draft.collocations} onChange={(event) => onFieldChange('collocations', event.target.value)} />
        </FormField>
        <FormField label="Pattern">
          <input className="wp-input" value={draft.pattern} onChange={(event) => onFieldChange('pattern', event.target.value)} />
        </FormField>
        <FormField label="Notes">
          <textarea className="wp-input wp-textarea" rows={3} value={draft.notes} onChange={(event) => onFieldChange('notes', event.target.value)} />
        </FormField>
      </div>

      <div className="word-page-edit-actions">
        {saveError && <div className="wp-save-error">{saveError}</div>}
        <div className="word-page-edit-actions-row">
          <button type="button" className="wp-btn-delete" onClick={onDelete}>Delete</button>
          <div className="word-page-edit-actions-right">
            <button type="button" className="wp-btn-cancel" onClick={onCancel}>Cancel</button>
            <button type="button" className="wp-btn-save" disabled={savePending} onClick={onSave}>
              {savePending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function FormField({label, children}: {label: string; children: ReactNode}) {
  return (
    <div className="wp-field">
      <label className="wp-label">{label}</label>
      {children}
    </div>
  )
}
