import {useState, useMemo, useEffect, useRef} from 'react'
import {useParams, useNavigate, useLocation} from 'react-router-dom'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {fetchWord, updateWord, deleteWord} from './api'
import {fetchTopics} from '../topics/api'
import type {Word} from '../../shared/http'
import {LEVEL_LABELS, levelClass} from '../../shared/wordDomain'
import {CompactDropdown} from '../../shared/CompactDropdown'
import type {DropdownOption} from '../../shared/CompactDropdown'
import {ConfirmModal} from '../../shared/ConfirmModal'

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
  {value: '5', label: '5 — Parked (rare, learn later)'},
]

type EditState = {
  term: string; translations: string; knowledge_level: string; part_of_speech: string
  topic_ids: string[]; countability: string; past_simple: string; past_participle: string
  example: string; notes: string; pattern: string
}

function toEditState(word: Word): EditState {
  return {
    term: word.term, translations: word.translations,
    knowledge_level: String(word.knowledge_level ?? ''),
    part_of_speech: word.part_of_speech ?? '',
    topic_ids: word.topic_ids.map(String),
    countability: word.countability ?? '',
    past_simple: word.past_simple ?? '',
    past_participle: word.past_participle ?? '',
    example: word.example ?? '', notes: word.notes ?? '', pattern: word.pattern ?? '',
  }
}

export function WordPage() {
  const {wordId}    = useParams<{wordId: string}>()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const editing     = useLocation().pathname.endsWith('/edit')

  const [draft, setDraft]           = useState<EditState | null>(null)
  const [confirming, setConfirming] = useState(false)

  const wordQuery   = useQuery({queryKey: ['word', wordId], queryFn: () => fetchWord(Number(wordId))})
  const topicsQuery = useQuery({queryKey: ['topics'], queryFn: fetchTopics})

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Word>) => updateWord(Number(wordId), payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['word', wordId], updated)
      queryClient.setQueryData<Word[]>(['words'], (cur = []) => cur.map((w) => w.id === updated.id ? updated : w))
      navigate(`/words/${wordId}`, {replace: true})
      setDraft(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteWord(Number(wordId)),
    onSuccess: () => {
      queryClient.setQueryData<Word[]>(['words'], (cur = []) => cur.filter((w) => w.id !== Number(wordId)))
      queryClient.removeQueries({queryKey: ['word', wordId]})
      navigate(capturedTopicSlug.current ?? '/', {replace: true})
    },
  })

  // Capture the topic slug synchronously before delete fires so onSuccess
  // doesn't depend on stale closure state or a re-fetch racing the navigation.
  const capturedTopicSlug = useRef<string | null>(null)

  function handleDelete() {
    capturedTopicSlug.current = topic?.slug ?? null
    setConfirming(false)
    deleteMutation.mutate()
  }

  const word   = wordQuery.data
  const topics = topicsQuery.data ?? []
  // primary topic = topic_ids[0] order, used for back-navigation
  const topic  = word?.topic_ids.length
    ? topics.find((t) => t.id === word.topic_ids[0])
    : undefined

  const allWords   = queryClient.getQueryData<Word[]>(['words']) ?? []
  const topicWords = useMemo(
    () => word && topic
      ? allWords.filter((w) => w.topic_ids.includes(topic.id)).sort((a, b) => a.term.localeCompare(b.term))
      : [],
    [allWords, word, topic],
  )
  const currentIdx = topicWords.findIndex((w) => w.id === word?.id)
  const prevWord   = currentIdx > 0 ? topicWords[currentIdx - 1] : null
  const nextWord   = currentIdx >= 0 && currentIdx < topicWords.length - 1 ? topicWords[currentIdx + 1] : null

  useEffect(() => {
    if (editing && word && !draft) setDraft(toEditState(word))
    if (!editing) setDraft(null)
  }, [editing, word?.id])

  if (wordQuery.isLoading) return <div className="word-page-loading">Loading…</div>
  if (!word) return <div className="word-page-loading">Word not found.</div>

  const lc     = levelClass(word.knowledge_level)
  const isVerb = (draft?.part_of_speech ?? word.part_of_speech) === 'verb'
  const isNoun = (draft?.part_of_speech ?? word.part_of_speech) === 'noun'

  function set(field: keyof EditState, value: string | string[]) {
    setDraft((d) => d ? {...d, [field]: value} : d)
  }

  function save() {
    if (!draft || !word) return
    const topicIds = draft.topic_ids.map(Number).filter((n) => n > 0)
    if (topicIds.length === 0) return  // guard: must have at least one valid topic
    saveMutation.mutate({
      term:            draft.term.trim() || word.term,
      translations:    draft.translations.trim() || word.translations,
      knowledge_level: draft.knowledge_level ? Number(draft.knowledge_level) as 1|2|3|4|5 : null,
      part_of_speech:  draft.part_of_speech || null,
      topic_ids:       topicIds,
      countability:    isNoun && draft.countability ? draft.countability : null,
      past_simple:     isVerb && draft.past_simple.trim() ? draft.past_simple.trim() : null,
      past_participle: isVerb && draft.past_participle.trim() ? draft.past_participle.trim() : null,
      example:         draft.example.trim() || null,
      notes:           draft.notes.trim() || null,
      pattern:         draft.pattern.trim() || null,
    })
  }

  return (
    <div className="word-page">

      <div className="word-page-hero-wrap">
        <div className="word-page-topbar">
          <button
            type="button"
            className="word-page-back-btn"
            onClick={() => editing ? navigate(`/words/${wordId}`, {replace: true}) : navigate(`/topics/${topic?.slug ?? ''}`)}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12" />
            </svg>
            Back
          </button>
          {!editing && (
            <button type="button" className="word-page-edit-btn" onClick={() => navigate(`/words/${wordId}/edit`)}>
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
            <ViewRow label="Translation"    value={word.translations} />
            <ViewRow label="Part of speech" value={word.part_of_speech ?? '—'} />
            <ViewRow label="Topics"         value={topics.filter((t) => word.topic_ids.includes(t.id)).map((t) => t.name).join(', ') || '—'} />
            <ViewRow label="Knowledge"      value={word.knowledge_level ? `${word.knowledge_level} — ${LEVEL_LABELS[word.knowledge_level]}` : '—'} />
            {word.countability    && <ViewRow label="Countability"    value={word.countability} />}
            {word.example         && <ViewRow label="Example"         value={word.example} />}
            {word.notes           && <ViewRow label="Notes"           value={word.notes} />}
            {word.pattern         && <ViewRow label="Pattern"         value={word.pattern} />}
            {word.past_simple     && <ViewRow label="Past simple"     value={word.past_simple} />}
            {word.past_participle && <ViewRow label="Past participle" value={word.past_participle} />}
            <ViewRow label="Updated" value={new Date(word.updated_at).toLocaleDateString()} />
            <ViewRow label="Created" value={new Date(word.created_at).toLocaleDateString()} />
          </div>
        )}

        {editing && draft && (
          <div className="word-page-edit-form">
            <FormField label="Term">
              <input className="wp-input" value={draft.term} onChange={(e) => set('term', e.target.value)} />
            </FormField>
            <FormField label="Translations">
              <input className="wp-input" value={draft.translations} onChange={(e) => set('translations', e.target.value)} />
            </FormField>
            <FormField label="Knowledge level">
              <CompactDropdown value={draft.knowledge_level} options={LEVEL_OPTIONS} onChange={(v) => set('knowledge_level', v)} ariaLabel="Knowledge level" />
            </FormField>
            <FormField label="Part of speech">
              <CompactDropdown value={draft.part_of_speech} options={POS_OPTIONS} onChange={(v) => set('part_of_speech', v)} ariaLabel="Part of speech" />
            </FormField>
            <FormField label="Primary topic">
              <CompactDropdown
                value={draft.topic_ids[0] ?? ''}
                options={[
                  {value: '', label: '— select topic —'},
                  ...topics.map((t) => ({value: String(t.id), label: t.name})),
                ]}
                onChange={(v) => set('topic_ids', [v])}
                ariaLabel="Primary topic"
              />
            </FormField>
            {isNoun && (
              <FormField label="Countability">
                <CompactDropdown value={draft.countability} options={COUNTABILITY_OPTIONS} onChange={(v) => set('countability', v)} ariaLabel="Countability" />
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
          </div>
        )}
      </div>

      {editing && (
        <div className="word-page-edit-actions">
          <button type="button" className="wp-btn-delete" onClick={() => setConfirming(true)}>Delete</button>
          <div className="word-page-edit-actions-right">
            <button type="button" className="wp-btn-cancel" onClick={() => navigate(`/words/${wordId}`, {replace: true})}>Cancel</button>
            <button type="button" className="wp-btn-save" disabled={saveMutation.isPending} onClick={save}>
              {saveMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {!editing && (
        <div className="word-page-footer">
          <button type="button" className="word-page-nav-btn" disabled={!prevWord} onClick={() => prevWord && navigate(`/words/${prevWord.id}`)}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,2 4,7 9,12" /></svg>
            Prev
          </button>
          <span className="word-page-nav-pos">{currentIdx >= 0 ? `${currentIdx + 1} / ${topicWords.length}` : ''}</span>
          <button type="button" className="word-page-nav-btn word-page-nav-btn-next" disabled={!nextWord} onClick={() => nextWord && navigate(`/words/${nextWord.id}`)}>
            Next
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="5,2 10,7 5,12" /></svg>
          </button>
        </div>
      )}

      {confirming && (
        <ConfirmModal
          title="Move to Trash?"
          message={`"${word.term}" will be moved to Trash and permanently deleted after 30 days.`}
          confirmLabel="Move to Trash"
          danger
          onConfirm={() => handleDelete()}
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
