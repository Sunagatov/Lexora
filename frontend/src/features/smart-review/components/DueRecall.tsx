import {useSyncExternalStore} from 'react'
import {useQuery} from '@tanstack/react-query'
import {languagePreferences, subscribeLanguages} from '@/features/languages/api'
import {SavedRecallPractice} from '@/features/stats/components/StatsEntryExplorer'
import {loadDueRecallWords} from '@/features/stats/model/recallHistory'

export function DueRecall({onClose}: {onClose: () => void}) {
  const {language, translationLanguage} = useSyncExternalStore(subscribeLanguages, languagePreferences)
  const {data, isLoading, refetch} = useQuery({
    queryKey: ['due-recall', language, translationLanguage],
    queryFn: ({signal}) => loadDueRecallWords(language, translationLanguage, signal),
    gcTime: 0, retry: false, refetchOnReconnect: false, refetchOnWindowFocus: false,
  })
  return <div className="main-inner">
    <h1>Due recall</h1>
    {data?.length ? <SavedRecallPractice words={data} language={language} translationLanguage={translationLanguage}
      onClose={onClose} /> : <>
      <p role="status">{isLoading ? 'Loading due words…' : data ? 'You have no words due for recall.' : 'Could not load due words.'}</p>
      {!isLoading && !data && <button type="button" className="word-page-back-btn" onClick={() => { void refetch() }}>Retry</button>}
      <button type="button" className="word-page-back-btn" onClick={onClose}>Back to Daily Word Mix</button>
    </>}
  </div>
}
