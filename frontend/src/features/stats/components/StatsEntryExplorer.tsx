import {useState, useSyncExternalStore} from 'react'
import {skipToken, useQuery, useQueryClient} from '@tanstack/react-query'
import {Link} from 'react-router-dom'
import {queryKeys} from '@/app/queryKeys'
import {routes} from '@/app/routes'
import {languagePreferences, subscribeLanguages} from '@/features/languages/api'
import {PeriodTabs} from '@/features/stats/components/StatsComponents'
import {RecallPractice} from '@/features/stats/components/RecallPractice'
import {readRecallHistory, saveRecallAttempt, summarizeRecallHistory} from '@/features/stats/model/recallHistory'
import type {StatsEntry, StatsEntryPage} from '@/features/stats/types/statsTypes'
import {LevelDropdown} from '@/features/words/components/LevelDropdown'
import {useWordUpdate} from '@/features/words/hooks/useWordUpdate'
import {strToLevel} from '@/features/words/model/wordDomain'
import type {Word, WordKnowledgeLevel} from '@/features/words/types/wordTypes'

export function StatsEntryExplorer<T extends string>({options, scope, load, loadPractice}: {
  options: {value: T; label: string}[]
  scope: 'library-gaps' | 'revisit'
  load: (value: T, page: number, signal: AbortSignal) => Promise<StatsEntryPage>
  loadPractice?: (value: T, page: number, signal: AbortSignal) => Promise<Word[]>
}) {
  const [selection, setSelection] = useState<{value: T; page: number} | null>(null)
  const [practiceOpen, setPracticeOpen] = useState(false)
  const {language, translationLanguage} = useSyncExternalStore(subscribeLanguages, languagePreferences)
  const {data, isFetching, isError, refetch} = useQuery({
    queryKey: [...queryKeys.stats, scope, language, translationLanguage, selection],
    queryFn: selection ? ({signal}) => load(selection.value, selection.page, signal) : skipToken,
  })
  const practice = useQuery({
    queryKey: [...queryKeys.stats, 'recall-practice', language, translationLanguage, selection],
    queryFn: practiceOpen && selection && loadPractice
      ? ({signal}) => loadPractice(selection.value, selection.page, signal)
      : skipToken,
    retry: false,
  })
  const hasRecall = !!loadPractice && 'indexedDB' in window

  function changePage(step: number) {
    setSelection((current) => current && {...current, page: current.page + step})
  }

  if (practiceOpen) return (
    <div className="stats-entry-explorer">
      {practice.data ? <SavedRecallPractice words={practice.data} language={language} translationLanguage={translationLanguage}
        onClose={() => setPracticeOpen(false)} /> : <>
        <p role="status">{practice.isError ? 'Could not load practice words.' : 'Loading practice words…'}</p>
        {practice.isError && <button type="button" className="word-page-back-btn" onClick={() => { void practice.refetch() }}>Retry</button>}
        <button type="button" className="word-page-back-btn" onClick={() => setPracticeOpen(false)}>Back to words</button>
      </>}
    </div>
  )

  return (
    <div className="stats-entry-explorer">
      <PeriodTabs options={options} value={selection?.value}
        onChange={(value) => setSelection((current) => current?.value === value ? null : {value, page: 1})} />
      {hasRecall && <RecallSummary language={language} translationLanguage={translationLanguage} />}
      {selection && (
        <div aria-live="polite">
          {isFetching && !data && <p className="stats-empty">Loading words…</p>}
          {isError && <button type="button" className="word-page-back-btn" onClick={() => { void refetch() }}>Retry loading words</button>}
          {data && <>
            <p className="stats-tracking-note">{data.total.toLocaleString()} matching {data.total === 1 ? 'word' : 'words'}</p>
            {hasRecall && data.entries.length > 0 && <button type="button" className="word-page-back-btn"
              onClick={() => setPracticeOpen(true)}>Start review</button>}
            {data.entries.length > 0 && <ul className="stats-entry-list">
              {data.entries.map((entry) => <li key={entry.id}>
                <Link to={routes.word(entry.id)}>{entry.term}</Link>
                {scope === 'revisit' && <RevisitRating entry={entry} />}
              </li>)}
            </ul>}
            {(selection.page > 1 || data.has_more) && <div className="stats-entry-pagination">
              <button type="button" className="word-page-back-btn" disabled={selection.page === 1} onClick={() => changePage(-1)}>Previous</button>
              <span>Page {selection.page}</span>
              <button type="button" className="word-page-back-btn" disabled={!data.has_more} onClick={() => changePage(1)}>Next</button>
            </div>}
          </>}
        </div>
      )}
    </div>
  )
}

const recallHistoryKey = ['device-recall-history'] as const

function SavedRecallPractice({words, language, translationLanguage, onClose}: {
  words: Word[]
  language: string
  translationLanguage: string
  onClose: () => void
}) {
  const client = useQueryClient()
  return <RecallPractice words={words} onClose={onClose} recordOutcome={async (wordId, recalled, occurredAt) => {
    await saveRecallAttempt({wordId, recalled, occurredAt, language, translationLanguage})
    void client.invalidateQueries({queryKey: recallHistoryKey})
  }} />
}

function RecallSummary({language, translationLanguage}: {language: string; translationLanguage: string}) {
  const {data} = useQuery({queryKey: recallHistoryKey, queryFn: readRecallHistory, retry: false})
  if (!data?.length) return null
  const {attempts, recalled, delayed, delayedRecalled} = summarizeRecallHistory(data, language, translationLanguage)
  if (!attempts) return null
  return <p className="stats-tracking-note">
    On this device, {recalled.toLocaleString()} of {attempts.toLocaleString()} attempts recalled.
    {delayed > 0 && <> After at least 24 hours between attempts, {delayedRecalled.toLocaleString()} of {delayed.toLocaleString()} recalled.</>}
  </p>
}

function RevisitRating({entry}: {entry: StatsEntry}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null)
  const [error, setError] = useState(false)
  const {updateLevelAsync, pendingWordIds} = useWordUpdate(() => {}, 'study_list')

  async function rate(level: WordKnowledgeLevel) {
    setAnchor(null)
    setError(false)
    try { await updateLevelAsync(entry.id, level) }
    catch { setError(true) }
  }

  return (
    <div className="stats-entry-rating">
      <button type="button" className="word-page-back-btn" aria-label={`Rate ${entry.term}`}
        disabled={pendingWordIds.has(entry.id)} onClick={(event) => setAnchor(event.currentTarget)}>Rate</button>
      {error && <span role="alert">Could not save rating.</span>}
      {anchor && <LevelDropdown anchor={anchor} term={entry.term} current={strToLevel(String(entry.knowledge_level ?? ''))}
        onSelect={(level) => { void rate(level) }} onClose={() => setAnchor(null)} />}
    </div>
  )
}
