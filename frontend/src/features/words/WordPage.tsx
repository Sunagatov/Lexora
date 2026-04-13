import {useState, useMemo, useEffect, useRef} from 'react'
import {useParams, useNavigate, useLocation} from 'react-router-dom'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {fetchWord, updateWord, deleteWord} from './api'
import {fetchTopics} from '../topics/api'
import type {Word, Topic} from '../../shared/http'
import {ApiError} from '../../shared/apiError'
import {LEVEL_LABELS, levelClass, levelToStr, strToLevel} from '../../shared/wordDomain'
import {toStr, toNullStr, toNullStrIf} from '../../shared/utils'
import {ConfirmModal} from '../../shared/ConfirmModal'
import {queryKeys} from '../../shared/queryKeys'
import {routes} from '../../shared/routes'

type EditState = {
  term: string; translations: string; knowledge_level: string; part_of_speech: string
  topic_ids: string[]; countability: string; past_simple: string; past_participle: string
  example: string; notes: string; pattern: string
}

function toEditState(word: Word): EditState {
  return {
    term:            word.term,
    translations:    word.translations,
    knowledge_level: levelToStr(word.knowledge_level),
    part_of_speech:  toStr(word.part_of_speech),
    topic_ids:       word.topic_ids.map(String),
    countability:    toStr(word.countability),
    past_simple:     toStr(word.past_simple),
    past_participle: toStr(word.past_participle),
    example:         toStr(word.example),
    notes:           toStr(word.notes),
    pattern:         toStr(word.pattern),
  }
}

function resolveTopic(word: Word, topics: Topic[], fromTopicSlug: string | undefined): Topic | undefined {
  if (!word.topic_ids.length) return undefined
  if (fromTopicSlug) {
    return topics.find((t) => t.slug === fromTopicSlug) ?? topics.find((t) => t.id === word.topic_ids[0])
  }
  return topics.find((t) => t.id === word.topic_ids[0])
}

function buildSavePayload(draft: EditState, isVerb: boolean, isNoun: boolean): Partial<Word> {
  return {
    term:            draft.term.trim(),
    translations:    draft.translations.trim(),
    knowledge_level: strToLevel(draft.knowledge_level),
    part_of_speech:  toNullStr(draft.part_of_speech),
    topic_ids:       draft.topic_ids.map(Number).filter((n) => n > 0),
    countability:    toNullStrIf(isNoun, draft.countability),
    past_simple:     toNullStrIf(isVerb, draft.past_simple),
    past_participle: toNullStrIf(isVerb, draft.past_participle),
    example:         toNullStr(draft.example),
    notes:           toNullStr(draft.notes),
    pattern:         toNullStr(draft.pattern),
  }
}

export function WordPage() {
  const {wordId}    = useParams<{wordId: string}>()
  const navigate    = useNavigate()
  const location    = useLocation()
  const queryClient = useQueryClient()
  const editing     = location.pathname.endsWith('/edit')
  const fromTopicSlug = (location.state as {fromTopicSlug?: string} | null)?.fromTopicSlug

  const [draft, setDraft]           = useState<EditState | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saveError,  setSaveError]  = useState<string | null>(null)

  const wordQuery   = useQuery({queryKey: queryKeys.word(Number(wordId)), queryFn: () => fetchWord(Number(wordId))})
  const topicsQuery = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<Word>) => updateWord(Number(wordId), payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.word(Number(wordId)), updated)
      queryClient.setQueryData<Word[]>(queryKeys.words, (cur = []) => cur.map((w) => w.id === updated.id ? updated : w))
      navigate(routes.word(Number(wordId)), {replace: true, state: location.state})
      setDraft(null)
      setSaveError(null)
    },
    onError: (err: Error) => {
      const msg = err instanceof ApiError && err.status === 409
        ? 'A word with this term already exists in the selected topic.'
        : err instanceof ApiError && (err.status === 400 || err.status === 422)
        ? 'Invalid data — check the fields and try again.'
        : 'Failed to save. Please try again.'
      setSaveError(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteWord(Number(wordId)),
    onSuccess: () => {
      queryClient.setQueryData<Word[]>(queryKeys.words, (cur = []) => cur.filter((w) => w.id !== Number(wordId)))
      queryClient.removeQueries({queryKey: queryKeys.word(Number(wordId))})
      navigate(capturedTopicSlug.current ? routes.topic(capturedTopicSlug.current) : routes.home, {replace: true})
    },
  })

  const capturedTopicSlug = useRef<string | null>(null)

  function handleDelete() {
    capturedTopicSlug.current = topic?.slug ?? null
    setConfirming(false)
    deleteMutation.mutate()
  }

  const word   = wordQuery.data
  const topics = topicsQuery.data ?? []
  const topic  = word ? resolveTopic(word, topics, fromTopicSlug) : undefined

  const allWords   = queryClient.getQueryData<Word[]>(queryKeys.words) ?? []
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
    setSaveError(null)
    const termVal  = draft.term.trim()
    const transVal = draft.translations.trim()
    const topicIds = draft.topic_ids.map(Number).filter((n) => n > 0)
    if (!termVal)         { setSaveError('Term cannot be empty.'); return }
    if (!transVal)        { setSaveError('Translation cannot be empty.'); return }
    if (!topicIds.length) { setSaveError('Please select a topic.'); return }
    saveMutation.mutate(buildSavePayload(draft, isVerb, isNoun))
  }

  return (
    <div className="word-page">

      <div className="word-page-hero-wrap">
        <div className="word-page-topbar">
          <button
            type="button"
            className="word-page-back-btn"
            onClick={() => editing
              ? navigate(routes.word(Number(wordId)), {replace: true, state: location.state})
              : navigate(routes.topic(topic?.slug ?? ''))}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12" />
            </svg>
            Back
          </button>
          {!editing && (
            <button type="button" className="word-page-edit-btn" onClick={() => navigate(routes.editWord(Number(wordId)), {state: location.state})}>
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
              <input className="wp-input" value={draft.term} maxLength={255} onChange={(e) => { set('term', e.target.value); setSaveError(null) }} />
            </FormField>
            <FormField label="Translations">
              <input className="wp-input" value={draft.translations} onChange={(e) => { set('translations', e.target.value); setSaveError(null) }} />
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
          {saveError && <div className="wp-save-error">{saveError}</div>}
          <div className="word-page-edit-actions-row">
            <button type="button" className="wp-btn-delete" onClick={() => setConfirming(true)}>Delete</button>
            <div className="word-page-edit-actions-right">
              <button type="button" className="wp-btn-cancel" onClick={() => { navigate(routes.word(Number(wordId)), {replace: true, state: location.state}); setSaveError(null) }}>Cancel</button>
              <button type="button" className="wp-btn-save" disabled={saveMutation.isPending} onClick={save}>
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!editing && (
        <div className="word-page-footer">
          <button type="button" className="word-page-nav-btn" disabled={!prevWord} onClick={() => prevWord && navigate(routes.word(prevWord.id), {state: location.state})}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,2 4,7 9,12" /></svg>
            Prev
          </button>
          <span className="word-page-nav-pos">{currentIdx >= 0 ? `${currentIdx + 1} / ${topicWords.length}` : ''}</span>
          <button type="button" className="word-page-nav-btn word-page-nav-btn-next" disabled={!nextWord} onClick={() => nextWord && navigate(routes.word(nextWord.id), {state: location.state})}>
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
