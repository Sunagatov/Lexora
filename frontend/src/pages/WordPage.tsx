import {useState, useMemo} from 'react'
import {useParams, useNavigate} from 'react-router-dom'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {fetchWord, fetchTopics, updateWord, deleteWord} from '../lib/api'
import type {Word} from '../lib/api'
import {LEVEL_LABELS, levelClass} from '../lib/words'
import {CompactDropdown} from '../components/study/CompactDropdown'
import type {DropdownOption} from '../components/study/CompactDropdown'
import {ConfirmModal} from '../components/ConfirmModal'

const POS_OPTIONS: DropdownOption<string>[] = [
  {value: '',            label: '— not set —'},
  {value: 'noun',        label: 'Noun'},
  {value: 'verb',        label: 'Verb'},
  {value: 'adjective',   label: 'Adjective'},
  {value: 'adverb',      label: 'Adverb'},
  {value: 'phrase',      label: 'Phrase'},
  {value: 'preposition', label: 'Preposition'},
  {value: 'other',       label: 'Other'},
]

const COUNTABILITY_OPTIONS: DropdownOption<string>[] = [
  {value: '',            label: '— not set —'},
  {value: 'Countable',   label: 'Countable'},
  {value: 'Uncountable', label: 'Uncountable'},
  {value: 'Both',        label: 'Both'},
]

const LEVEL_OPTIONS: DropdownOption<string>[] = [
  {value: '',  label: '— not set —'},
  {value: '1', label: '1 — Weak'},
  {value: '2', label: '2 — Basic'},
  {value: '3', label: '3 — Okay'},
  {value: '4', label: '4 — Strong'},
  {value: '5', label: '5 — Master'},
]

type EditState = {
  term: string
  translations: string
  knowledge_level: string
  part_of_speech: string
  topic_id: string
  countability: string
  past_simple: string
  past_participle: string
  example: string
  notes: string
  pattern: string
}

function toEditState(word: Word): EditState {
  return {
    term:            word.term,
    translations:    word.translations,
    knowledge_level: String(word.knowledge_level ?? ''),
    part_of_speech:  word.part_of_speech ?? '',
    topic_id:        String(word.topic_id),
    countability:    word.countability ?? '',
    past_simple:     word.past_simple ?? '',
    past_participle: word.past_participle ?? '',
    example:         word.example ?? '',
    notes:           word.notes ?? '',
    pattern:         word.pattern ?? '',
  }
}

export function WordPage() {
  const {wordId}    = useParams<{wordId: string}>()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()

  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState<EditState | null>(null)
  const [confirming, setConfirming] = useState(false)

  const wordQuery   = useQuery({queryKey: ['word', wordId], queryFn: () => fetchWord(Number(wordId))})
  const topicsQuery = useQuery({queryKey: ['topics'], queryFn: fetchTopics})

  const mutation = useMutation({
    mutationFn: (payload: Partial<Word>) => updateWord(Number(wordId), payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['word', wordId], updated)
      queryClient.setQueryData<Word[]>(['words'], (cur = []) =>
        cur.map((w) => w.id === updated.id ? updated : w),
      )
      setEditing(false)
      setDraft(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteWord(Number(wordId)),
    onSuccess: () => {
      queryClient.setQueryData<Word[]>(['words'], (cur = []) =>
        cur.filter((w) => w.id !== Number(wordId)),
      )
      navigate(`/study/topics/${word?.topic_id ?? ''}`)
    },
  })

  const word   = wordQuery.data
  const topics = topicsQuery.data ?? []
  const topic  = topics.find((t) => t.id === word?.topic_id)

  // Prev/next within same topic from cache
  const allWords = queryClient.getQueryData<Word[]>(['words']) ?? []
  const topicWords = useMemo(
    () => word ? allWords.filter((w) => w.topic_id === word.topic_id).sort((a, b) => a.term.localeCompare(b.term)) : [],
    [allWords, word],
  )
  const currentIdx = topicWords.findIndex((w) => w.id === word?.id)
  const prevWord   = currentIdx > 0 ? topicWords[currentIdx - 1] : null
  const nextWord   = currentIdx >= 0 && currentIdx < topicWords.length - 1 ? topicWords[currentIdx + 1] : null

  if (wordQuery.isLoading) return <div className="word-page-loading">Loading…</div>
  if (!word) return <div className="word-page-loading">Word not found.</div>

  const lc = levelClass(word.knowledge_level)

  function startEdit() {
    setDraft(toEditState(word!))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setDraft(null)
  }

  function set(field: keyof EditState, value: string) {
    setDraft((d) => d ? {...d, [field]: value} : d)
  }

  function save() {
    if (!draft) return
    const isVerb = draft.part_of_speech === 'verb'
    const isNoun = draft.part_of_speech === 'noun'
    mutation.mutate({
      term:            draft.term.trim() || word.term,
      translations:    draft.translations.trim() || word.translations,
      knowledge_level: draft.knowledge_level ? Number(draft.knowledge_level) as 1|2|3|4|5 : null,
      part_of_speech:  draft.part_of_speech || null,
      topic_id:        Number(draft.topic_id),
      countability:    isNoun && draft.countability ? draft.countability : null,
      past_simple:     isVerb && draft.past_simple.trim() ? draft.past_simple.trim() : null,
      past_participle: isVerb && draft.past_participle.trim() ? draft.past_participle.trim() : null,
      example:         draft.example.trim() || null,
      notes:           draft.notes.trim() || null,
      pattern:         draft.pattern.trim() || null,
    })
  }

  const isVerb = (draft?.part_of_speech ?? word.part_of_speech) === 'verb'
  const isNoun = (draft?.part_of_speech ?? word.part_of_speech) === 'noun'

  return (
    <div className="word-page">

      {/* Sticky header */}
      <div className="word-page-header">
        <button type="button" className="word-page-brand" onClick={() => navigate('/')}>
          Lexora
        </button>
        {!editing && (
          <button type="button" className="word-page-edit-btn" onClick={startEdit}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" />
            </svg>
            Edit
          </button>
        )}
      </div>

      <div className="word-page-inner">

        {/* Back row */}
        <div className="word-page-topbar">
          <button type="button" className="word-page-back-btn" onClick={() => navigate(`/study/topics/${word.topic_id}`)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12" />
            </svg>
            Back
          </button>
        </div>

        {/* Hero */}
        <div className={`word-page-hero ${lc}`}>
          <h1 className="word-page-term">{word.term}</h1>
        </div>

        {/* View mode — all fields as rows */}
        {!editing && (
          <div className="word-page-view">
            <ViewRow label="Translation"    value={word.translations} />
            <ViewRow label="Part of speech" value={word.part_of_speech ?? '—'} />
            <ViewRow label="Topic"          value={topic?.name ?? '—'} />
            <ViewRow label="Knowledge"      value={word.knowledge_level ? `${word.knowledge_level} — ${LEVEL_LABELS[word.knowledge_level]}` : '—'} />
            {word.countability  && <ViewRow label="Countability"   value={word.countability} />}
            {word.example       && <ViewRow label="Example"        value={word.example} />}
            {word.notes         && <ViewRow label="Notes"          value={word.notes} />}
            {word.pattern       && <ViewRow label="Pattern"        value={word.pattern} />}
            {word.past_simple   && <ViewRow label="Past simple"    value={word.past_simple} />}
            {word.past_participle && <ViewRow label="Past participle" value={word.past_participle} />}
            <ViewRow label="Updated" value={new Date(word.updated_at).toLocaleDateString()} />
            <ViewRow label="Created" value={new Date(word.created_at).toLocaleDateString()} />
          </div>
        )}

        {/* Edit mode */}
        {editing && draft && (
          <div className="word-page-edit-form">

            <FormField label="Term">
              <input className="wp-input" value={draft.term} onChange={(e) => set('term', e.target.value)} />
            </FormField>

            <FormField label="Translations">
              <input className="wp-input" value={draft.translations} onChange={(e) => set('translations', e.target.value)} />
            </FormField>

            <FormField label="Knowledge level">
              <CompactDropdown
                value={draft.knowledge_level}
                options={LEVEL_OPTIONS}
                onChange={(v) => set('knowledge_level', v)}
                ariaLabel="Knowledge level"
              />
            </FormField>

            <FormField label="Part of speech">
              <CompactDropdown
                value={draft.part_of_speech}
                options={POS_OPTIONS}
                onChange={(v) => set('part_of_speech', v)}
                ariaLabel="Part of speech"
              />
            </FormField>

            <FormField label="Topic">
              <CompactDropdown
                value={draft.topic_id}
                options={topics.map((t) => ({value: String(t.id), label: t.name}))}
                onChange={(v) => set('topic_id', v)}
                ariaLabel="Topic"
              />
            </FormField>

            {isNoun && (
              <FormField label="Countability">
                <CompactDropdown
                  value={draft.countability}
                  options={COUNTABILITY_OPTIONS}
                  onChange={(v) => set('countability', v)}
                  ariaLabel="Countability"
                />
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

            <FormField label="Example">
              <textarea className="wp-input wp-textarea" rows={3} value={draft.example} onChange={(e) => set('example', e.target.value)} />
            </FormField>

            <FormField label="Notes">
              <textarea className="wp-input wp-textarea" rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
            </FormField>

            <FormField label="Pattern">
              <input className="wp-input" value={draft.pattern} onChange={(e) => set('pattern', e.target.value)} />
            </FormField>

            <div className="word-page-edit-actions">
              <button type="button" className="wp-btn-save" disabled={mutation.isPending} onClick={save}>
                {mutation.isPending ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="wp-btn-cancel" onClick={cancelEdit}>Cancel</button>
              <button type="button" className="wp-btn-delete" onClick={() => setConfirming(true)}>
                Delete
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Word navigation footer */}
      <div className="word-page-footer">
        <button
          type="button"
          className="word-page-nav-btn"
          disabled={!prevWord}
          onClick={() => prevWord && navigate(`/words/${prevWord.id}`)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="9,2 4,7 9,12" />
          </svg>
          {prevWord ? prevWord.term : '—'}
        </button>
        <span className="word-page-nav-pos">
          {currentIdx >= 0 ? `${currentIdx + 1} / ${topicWords.length}` : ''}
        </span>
        <button
          type="button"
          className="word-page-nav-btn word-page-nav-btn-next"
          disabled={!nextWord}
          onClick={() => nextWord && navigate(`/words/${nextWord.id}`)}
        >
          {nextWord ? nextWord.term : '—'}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="5,2 10,7 5,12" />
          </svg>
        </button>
      </div>

      {confirming && (
        <ConfirmModal
          title="Move to Trash?"
          message={`"${word.term}" will be moved to Trash and permanently deleted after 30 days.`}
          confirmLabel="Move to Trash"
          danger
          onConfirm={() => { setConfirming(false); deleteMutation.mutate() }}
          onCancel={() => setConfirming(false)}
        />
      )}

    </div>
  )
}

function ViewRow({label, value}: {label: string; value: string}) {
  return (
    <div className="word-page-view-row">
      <span className="word-page-view-label">{label}</span>
      <span className="word-page-view-value">{value}</span>
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
