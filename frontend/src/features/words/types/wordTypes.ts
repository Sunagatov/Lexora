export type WordKnowledgeLevel = 1 | 2 | 3 | 4 | 5

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
