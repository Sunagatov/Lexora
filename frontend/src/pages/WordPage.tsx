import {useState} from 'react'
import {useParams, useNavigate} from 'react-router-dom'
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {fetchWord, fetchTopics, updateWord} from '../lib/api'
import type {Word} from '../lib/api'
import {LEVELS, LEVEL_LABELS, levelClass} from '../lib/words'

type EditableField = 'term' | 'translations' | 'part_of_speech' | 'example' | 'notes' | 'pattern' | 'countability' | 'past_simple' | 'past_participle'

const FIELD_LABELS: Record<EditableField, string> = {
  term:             'Term',
  translations:     'Translations',
  part_of_speech:   'Part of speech',
  example:          'Example',
  notes:            'Notes',
  pattern:          'Pattern',
  countability:     'Countability',
  past_simple:      'Past simple',
  past_participle:  'Past participle',
}

export function WordPage() {
  const {wordId} = useParams<{wordId: string}>()
  const navigate  = useNavigate()
  const queryClient = useQueryClient()

  const [editingField, setEditingField] = useState<EditableField | null>(null)
  const [editValue, setEditValue]       = useState('')

  const wordQuery  = useQuery({queryKey: ['word', wordId], queryFn: () => fetchWord(Number(wordId))})
  const topicsQuery = useQuery({queryKey: ['topics'], queryFn: fetchTopics})

  const mutation = useMutation({
    mutationFn: (payload: Partial<Word>) => updateWord(Number(wordId), payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(['word', wordId], updated)
      queryClient.setQueryData<Word[]>(['words'], (cur = []) =>
        cur.map((w) => w.id === updated.id ? updated : w),
      )
      setEditingField(null)
    },
  })

  const word   = wordQuery.data
  const topics = topicsQuery.data ?? []
  const topic  = topics.find((t) => t.id === word?.topic_id)

  if (wordQuery.isLoading) return <div className="word-page-loading">Loading…</div>
  if (!word) return <div className="word-page-loading">Word not found.</div>

  function startEdit(field: EditableField) {
    setEditingField(field)
    setEditValue((word![field] as string) ?? '')
  }

  function cancelEdit() {
    setEditingField(null)
    setEditValue('')
  }

  function saveEdit() {
    if (editingField === null) return
    mutation.mutate({[editingField]: editValue || null})
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && editingField !== 'example' && editingField !== 'notes') saveEdit()
    if (e.key === 'Escape') cancelEdit()
  }

  const lc = levelClass(word.knowledge_level)

  const fields: EditableField[] = [
    'translations', 'part_of_speech', 'example', 'notes',
    'pattern', 'countability', 'past_simple', 'past_participle',
  ]

  return (
    <div className="word-page">
      <div className="word-page-inner">

        <div className="word-page-back">
          <button type="button" className="word-page-back-btn" onClick={() => navigate(-1)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="9,2 4,7 9,12" />
            </svg>
            Back
          </button>
          {topic && (
            <button type="button" className="word-page-topic-chip" onClick={() => navigate(`/study/topics/${topic.id}`)}>
              {topic.name}
            </button>
          )}
        </div>

        <div className={`word-page-card ${lc}`}>
          <div className="word-page-term-row">
            {editingField === 'term' ? (
              <InlineInput
                value={editValue}
                onChange={setEditValue}
                onSave={saveEdit}
                onCancel={cancelEdit}
                onKeyDown={handleKeyDown}
                saving={mutation.isPending}
                large
              />
            ) : (
              <h1 className="word-page-term" onClick={() => startEdit('term')}>{word.term}</h1>
            )}
            <div className="word-page-level-wrap">
              <LevelSwitcher
                current={word.knowledge_level}
                saving={mutation.isPending}
                onSelect={(l) => mutation.mutate({knowledge_level: l})}
              />
            </div>
          </div>

          <div className="word-page-meta">
            <span className="word-page-meta-item">Updated {new Date(word.updated_at).toLocaleDateString()}</span>
            <span className="word-page-meta-sep">·</span>
            <span className="word-page-meta-item">Created {new Date(word.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        <div className="word-page-fields">
          {fields.map((field) => (
            <div key={field} className="word-page-field">
              <div className="word-page-field-label">{FIELD_LABELS[field]}</div>
              {editingField === field ? (
                <InlineInput
                  value={editValue}
                  onChange={setEditValue}
                  onSave={saveEdit}
                  onCancel={cancelEdit}
                  onKeyDown={handleKeyDown}
                  saving={mutation.isPending}
                  multiline={field === 'example' || field === 'notes'}
                />
              ) : (
                <div
                  className={`word-page-field-value ${!word[field] ? 'word-page-field-empty' : ''}`}
                  onClick={() => startEdit(field)}
                >
                  {(word[field] as string) || 'Click to add…'}
                </div>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

function InlineInput({value, onChange, onSave, onCancel, onKeyDown, saving, large, multiline}: {
  value: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  saving: boolean
  large?: boolean
  multiline?: boolean
}) {
  return (
    <div className="word-page-inline-edit">
      {multiline ? (
        <textarea
          className={`word-page-input ${large ? 'word-page-input-large' : ''}`}
          value={value}
          autoFocus
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
      ) : (
        <input
          className={`word-page-input ${large ? 'word-page-input-large' : ''}`}
          value={value}
          autoFocus
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
      )}
      <div className="word-page-inline-actions">
        <button type="button" className="word-page-save-btn" disabled={saving} onClick={onSave}>
          {saving ? '…' : 'Save'}
        </button>
        <button type="button" className="word-page-cancel-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function LevelSwitcher({current, saving, onSelect}: {
  current: number | null
  saving: boolean
  onSelect: (l: number) => void
}) {
  return (
    <div className="word-page-levels">
      {LEVELS.map((l) => (
        <button
          key={l}
          type="button"
          disabled={saving}
          className={`word-page-level-btn ${levelClass(l)} ${l === current ? 'active' : ''}`}
          onClick={() => onSelect(l)}
        >
          <span className="word-page-level-num">{l}</span>
          <span className="word-page-level-label">{LEVEL_LABELS[l]}</span>
        </button>
      ))}
    </div>
  )
}
