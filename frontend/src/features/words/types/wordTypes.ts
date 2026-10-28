export type WordKnowledgeLevel = 1 | 3 | 4 | 5

export type VerbForm = {
  past_simple: string | null
  past_participle: string | null
  present_participle: string | null
  third_person: string | null
}

export type ConfusableEntry = {
  value: string
  explanation: string | null
}

export type Word = {
  id: number
  topic_ids: number[]
  term: string
  language: string
  transliteration?: string | null
  pronunciation_easy?: string | null
  pronunciation_note_ru?: string | null
  translation_language?: 'ru' | 'en'
  translation_groups?: Record<string, string[]>
  explanation_groups?: Record<string, {definition?: string | null; notes?: string | null}>
  definition: string | null
  pronunciation_ipa: string | null
  pronunciation_audio_url: string | null
  image_url: string | null
  part_of_speech: string | null
  cefr_level: string | null
  register: string | null
  countability: string | null
  frequency_rank: number | null
  knowledge_level: WordKnowledgeLevel | null
  pattern: string | null
  notes: string | null
  is_active: boolean
  verb_form: VerbForm | null
  translation_entries: string[]
  example_entries: string[]
  example_count: number
  example_target_count: number
  example_status: 'missing' | 'partial' | 'complete'
  needs_example_enrichment: boolean
  synonym_entries: string[]
  antonym_entries: string[]
  collocation_entries: string[]
  confusable_entries: ConfusableEntry[]
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type EnrichResult = {
  transliteration?: string | null
  term: string
  definition: string | null
  pronunciation_ipa: string | null
  pronunciation_audio_url: string | null
  part_of_speech: string | null
  cefr_level: string | null
  register: string | null
  countability: string | null
  frequency_rank: number | null
  pattern: string | null
  notes: string | null
  translation_entries: string[]
  example_entries: string[]
  synonym_entries: string[]
  antonym_entries: string[]
  collocation_entries: string[]
  confusable_entries: ConfusableEntry[]
  verb_form: VerbForm | null
}

export type WorkbookImportSheetSummary = {
  sheet_name: string
  topic_name: string
  created: number
  updated: number
  skipped: number
}

export type WorkbookImportResponse = {
  created: number
  updated: number
  skipped: number
  sheets: WorkbookImportSheetSummary[]
}

export type ImportIssue = {sheet: string; row: number; message: string}
export type ImportEntry = {
  word_id: number | null
  action: 'create' | 'update' | 'unchanged'
  locations: {sheet: string; row: number}[]
  before: Record<string, unknown> | null
  after: Record<string, unknown>
}
export type WorkbookPreview = {
  batch_id: string | null
  plan_hash: string
  summary: {rows: number; created: number; updated: number; unchanged: number; topics_created: number}
  errors: ImportIssue[]
  warnings: ImportIssue[]
  entries: ImportEntry[]
  topics: {name: string}[]
  topic_labels?: Record<string, string>
}
export type WorkbookImportResult = WorkbookPreview['summary'] & {
  batch_id: string
  created_word_ids: number[]
  created_topic_ids: number[]
  progress_preserved: boolean
  replayed: boolean
}
