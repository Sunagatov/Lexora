import {useState} from 'react'
import {useQuery} from '@tanstack/react-query'
import {queryKeys} from '@/app/queryKeys'
import {fetchLibraryGap, fetchLibraryStats} from '@/features/stats/api/statsApi'
import {PeriodTabs, SectionTitle, StatCard, StatsPageSkeleton} from '@/features/stats/components/StatsComponents'
import {EnrichmentCoverageSection, VocabProfileSection} from '@/features/stats/components/StatsEnrichment'
import {DataQualitySection, TopicsSection, WordsAddedSection} from '@/features/stats/components/StatsSections'
import {StatsEntryExplorer} from '@/features/stats/components/StatsEntryExplorer'
import {LIBRARY_TOPIC_SORT_OPTIONS, buildMonthChartData, sortTopics, type LibraryTopicSort, type MonthPeriod} from '@/features/stats/model/statsPageModel'
import {EmptyState} from '@/shared/components/EmptyState'

export function LibraryStatsPage() {
  const [monthPeriod, setMonthPeriod] = useState<MonthPeriod>('all')
  const [topicSort, setTopicSort] = useState<LibraryTopicSort>('total')
  const {data: stats, isLoading, refetch} = useQuery({
    queryKey: queryKeys.libraryStats,
    queryFn: ({signal}) => fetchLibraryStats(signal),
  })

  if (isLoading) return <StatsPageSkeleton />
  if (!stats) return (
    <EmptyState icon="📚" title="Library statistics unavailable" description="Connect to Lexora and try again."
      variant="error" actions={[{label: 'Retry', onClick: () => { void refetch() }}]} />
  )

  const {overview, study_coverage: coverage, readiness} = stats
  const translationName = readiness.translation_language === 'ru' ? 'Russian' : 'English'
  return (
    <div className="stats-page">
      <div className="stats-inner">
        <section className="stats-section">
          <SectionTitle icon="📚">Library overview</SectionTitle>
          <div className="stats-cards stats-cards-2">
            <StatCard value={overview.total_words.toLocaleString()} label="Total words" />
            <StatCard value={overview.total_topics.toLocaleString()} label="Total topics" />
          </div>
        </section>
        <section className="stats-section">
          <SectionTitle icon="🧩" subtitle={`Ready to study means a ${translationName} translation and at least one example.`}>Library readiness</SectionTitle>
          <div className="stats-cards stats-cards-2">
            <StatCard value={readiness.ready.toLocaleString()} label="Ready to study" />
            <StatCard value={`${overview.total_words ? Math.round(100 * readiness.ready / overview.total_words) : 0}%`} label="Share ready" />
          </div>
          <StatsEntryExplorer scope="library-gaps" load={fetchLibraryGap} options={[
            {value: 'translation', label: `Missing translation (${readiness.missing_translation.toLocaleString()})`},
            {value: 'no-examples', label: `No examples (${readiness.no_examples.toLocaleString()})`},
            {value: 'needs-examples', label: `Need 3+ examples (${readiness.needs_examples.toLocaleString()})`},
            {value: 'no-topic', label: `No topic (${readiness.no_topic.toLocaleString()})`},
            {value: 'multiple-topics', label: `Multiple topics (${readiness.multiple_topics.toLocaleString()})`},
          ]} />
        </section>
        <VocabProfileSection profile={stats.vocab_profile} totalWords={overview.total_words} />
        <EnrichmentCoverageSection coverage={stats.enrichment_coverage} />
        <DataQualitySection overview={overview} />
        <WordsAddedSection monthPeriod={monthPeriod} onMonthPeriodChange={setMonthPeriod}
          monthChartData={buildMonthChartData(stats.words_added_by_month, monthPeriod)} />
        <TopicsSection
          topics={sortTopics(stats.topics, (topic) => topic[topicSort])}
          title="Topic coverage"
          subtitle="Words and missing content, including subtopics"
          empty="No topics yet."
          controls={<PeriodTabs options={LIBRARY_TOPIC_SORT_OPTIONS} value={topicSort} onChange={setTopicSort} />}
          columns={[
            {label: 'Words', value: (topic) => topic.total},
            {label: 'Need 3+', value: (topic) => topic.needs_example_enrichment},
            {label: 'No POS', value: (topic) => topic.missing_pos},
          ]}
        />
        <section className="stats-section">
          <SectionTitle icon="🧭" subtitle="Recorded reviews for words currently in the library">Study coverage</SectionTitle>
          <div className="stats-cards stats-cards-3">
            <StatCard value={coverage.reviewed_words.toLocaleString()} label="Reviewed" />
            <StatCard value={coverage.never_reviewed_words.toLocaleString()} label="Never reviewed" />
            <StatCard value={`${coverage.reviewed_word_share_pct}%`} label="Library reviewed" />
          </div>
        </section>
      </div>
    </div>
  )
}
