import {useNavigate, useLocation} from 'react-router-dom'
import {LEVEL_LABELS, levelClass} from '../../shared/wordDomain'
import {ConfirmModal} from '../../shared/ConfirmModal'
import {routes} from '../../shared/routes'
import {NotFoundPage} from '../../layout/NotFoundPage'
import {useWordPageState} from './useWordPageState'

export function WordPage() {
  const s = useWordPageState()
  const navigate = useNavigate()
  const location = useLocation()

  if (s.isInvalidWordId) return <NotFoundPage />
  if (s.isLoading) return <div className="word-page-loading">Loading…</div>
  if (!s.word) return <div className="word-page-loading">Word not found.</div>

  const {word, topics, topic, draft, set, editing} = s
  const lc = levelClass(word.knowledge_level)
  const isVerb = (draft?.part_of_speech ?? word.part_of_speech) === 'verb'
  const isNoun = (draft?.part_of_speech ?? word.part_of_speech) === 'noun'
  const translationsToView = word.translation_entries?.length
    ? word.translation_entries.join('\n')
    : word.translations
  const examplesToView = word.example_entries?.length
    ? word.example_entries.join('\n')
    : word.example
  const backRoute = topic?.slug
    ? routes.topic(topic.slug)
    : s.fromTopicSlug
      ? routes.topic(s.fromTopicSlug)
      : routes.home

  return (
    <div className="word-page">

      <div className="word-page-hero-wrap">
        <div className="word-page-topbar">
          <button
            type="button"
            className="word-page-back-btn"
            onClick={() => editing
              ? navigate(routes.word(s.wordId), {replace: true, state: location.state})
              : navigate(backRoute)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12" />
            </svg>
            Back
          </button>
          {!editing && (
            <button type="button" className="word-page-edit-btn" onClick={() => navigate(routes.editWord(s.wordId), {state: location.state})}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" />
              </svg>
              Edit
            </button>
          )}
        </div>
        <div className={`word-page-hero ${lc}`}>
          <h1 className="word-page-term">{word.term}</h1>
        </div>
      </div>

      <div className="word-page-inner">
        {!editing && (
          <div className="word-page-view">
            <ViewRow label="Translations" value={translationsToView} preserveLines />
            <ViewRow label="Part of speech" value={word.part_of_speech ?? '—'} />
            <ViewRow label="Topics" value={topics.filter((t) => word.topic_ids.includes(t.id)).map((t) => t.name).join(', ') || '—'} />
            <ViewRow label="Knowledge" value={word.knowledge_level ? `${word.knowledge_level} — ${LEVEL_LABELS[word.knowledge_level]}` : '—'} />
            {word.countability && <ViewRow label="Countability" value={word.countability} />}
            {(word.example_entries?.length
              ? <div className="word-page-view-row">
                  <span className="word-page-view-label">Examples</span>
                  <ol className="word-page-examples-list">
                    {word.example_entries.map((e, i) => <li key={i}>{e}</li>)}
                  </ol>
                </div>
              : examplesToView
                ? <ViewRow label="Examples" value={examplesToView} preserveLines />
                : null
            )}
            {word.notes && <ViewRow label="Notes" value={word.notes} preserveLines />}
            {word.pattern && <ViewRow label="Pattern" value={word.pattern} preserveLines />}
            {word.past_simple && <ViewRow label="Past simple" value={word.past_simple} />}
            {word.past_participle && <ViewRow label="Past participle" value={word.past_participle} />}
            <ViewRow label="Updated" value={new Date(word.updated_at).toLocaleDateString()} />
            <ViewRow label="Created" value={new Date(word.created_at).toLocaleDateString()} />
          </div>
        )}

        {editing && draft && (
          <div className="word-page-edit-form">
            <FormField label="Term">
              <input className="wp-input" value={draft.term} maxLength={255} onChange={(e) => { set('term', e.target.value); s.setSaveError(null) }} />
            </FormField>
            <FormField label="Translations (one per line)">
              <textarea
                className="wp-input wp-textarea"
                rows={4}
                value={draft.translations}
                onChange={(e) => { set('translations', e.target.value); s.setSaveError(null) }}
              />
            </FormField>
            <FormField label="Knowledge level">
              <select className="wp-input" value={draft.knowledge_level} onChange={(e) => set('knowledge_level', e.target.value)}>
                <option value="">— not set —</option>
                <option value="1">1 — Weak</option>
                <option value="2">2 — Basic</option>
                <option value="3">3 — Okay</option>
                <option value="4">4 — Strong</option>
                <option value="5">5 — Parked (rare, learn later)</option>
              </select>
            </FormField>
            <FormField label="Part of speech">
              <select className="wp-input" value={draft.part_of_speech} onChange={(e) => set('part_of_speech', e.target.value)}>
                <option value="">— not set —</option>
                <option value="noun">Noun</option>
                <option value="verb">Verb</option>
                <option value="adjective">Adjective</option>
                <option value="adverb">Adverb</option>
                <option value="phrase">Phrase</option>
                <option value="preposition">Preposition</option>
                <option value="other">Other</option>
              </select>
            </FormField>
            <FormField label="Primary topic">
              <select
                className="wp-input"
                value={draft.topic_ids[0] ?? ''}
                onChange={(e) => set('topic_ids', e.target.value ? [e.target.value, ...draft.topic_ids.slice(1)] : draft.topic_ids.slice(1))}
              >
                <option value="">— select topic —</option>
                {topics.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
              </select>
            </FormField>
            {isNoun && (
              <FormField label="Countability">
                <select className="wp-input" value={draft.countability} onChange={(e) => set('countability', e.target.value)}>
                  <option value="">— not set —</option>
                  <option value="Countable">Countable</option>
                  <option value="Uncountable">Uncountable</option>
                  <option value="Both">Both</option>
                  <option value="Plural">Plural</option>
                  <option value="Collective">Collective</option>
                </select>
              </FormField>
            )}
            {isVerb && (
              <>
                <FormField label="Past simple">
                  <input className="wp-input" value={draft.past_simple} onChange={(e) => set('past_simple', e.target.value)} />
                </FormField>
                <FormField label="Past participle">
                  <input className="wp-input" value={draft.past_participle} onChange={(e) => set('past_participle', e.target.value)} />
                </FormField>
              </>
            )}
            <FormField label="Examples (one per line)">
              <textarea className="wp-input wp-textarea" rows={5} value={draft.example} onChange={(e) => set('example', e.target.value)} />
            </FormField>
            <FormField label="Notes">
              <textarea className="wp-input wp-textarea" rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
            </FormField>
            <FormField label="Pattern">
              <input className="wp-input" value={draft.pattern} onChange={(e) => set('pattern', e.target.value)} />
            </FormField>
          </div>
        )}
      </div>

      {editing && (
        <div className="word-page-edit-actions">
          {s.saveError && <div className="wp-save-error">{s.saveError}</div>}
          <div className="word-page-edit-actions-row">
            <button type="button" className="wp-btn-delete" onClick={() => s.setConfirming(true)}>Delete</button>
            <div className="word-page-edit-actions-right">
              <button type="button" className="wp-btn-cancel" onClick={() => { navigate(routes.word(s.wordId), {replace: true, state: location.state}); s.setSaveError(null) }}>Cancel</button>
              <button type="button" className="wp-btn-save" disabled={s.savePending} onClick={s.save}>
                {s.savePending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!editing && (
        <div className="word-page-footer">
          <button type="button" className="word-page-nav-btn" disabled={!s.prevWord} onClick={() => s.prevWord && navigate(routes.word(s.prevWord.id), {state: location.state})}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,2 4,7 9,12" /></svg>
            Prev
          </button>
          <span className="word-page-nav-pos">{s.currentIdx >= 0 ? `${s.currentIdx + 1} / ${s.topicWords.length}` : ''}</span>
          <button type="button" className="word-page-nav-btn word-page-nav-btn-next" disabled={!s.nextWord} onClick={() => s.nextWord && navigate(routes.word(s.nextWord.id), {state: location.state})}>
            Next
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="5,2 10,7 5,12" /></svg>
          </button>
        </div>
      )}

      {s.confirming && (
        <ConfirmModal
          title="Move to Trash?"
          message={`"${word.term}" will be moved to Trash and permanently deleted after 30 days.`}
          confirmLabel="Move to Trash"
          danger
          onConfirm={s.handleDelete}
          onCancel={() => s.setConfirming(false)}
        />
      )}
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

function FormField({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div className="wp-field">
      <label className="wp-label">{label}</label>
      {children}
    </div>
  )
}
