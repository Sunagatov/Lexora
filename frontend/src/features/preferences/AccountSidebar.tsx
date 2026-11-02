import {useMemo} from 'react'
import {useNavigate} from 'react-router-dom'
import {useQuery} from '@tanstack/react-query'
import {queryKeys} from '@/app/queryKeys'
import {fetchTopics, fetchTopicSidebarStats} from '@/features/topics/api/topicsApi'
import {useTopicState} from '@/features/topics/hooks/useTopicState'
import {StudySidebarShell} from '@/features/study/components/StudySidebarShell'
import {routes} from '@/app/routes'

export function AccountSidebar({onClose}: {onClose: () => void}) {
  const navigate = useNavigate()
  const topicsQuery = useQuery({queryKey: queryKeys.topics, queryFn: fetchTopics})
  const stats = useQuery({queryKey: queryKeys.topicSidebar, queryFn: fetchTopicSidebarStats})
  const topics = useMemo(() => topicsQuery.data ?? [], [topicsQuery.data])
  const state = useTopicState(topics)
  const counts = new Map(Object.entries(stats.data?.topic_counts ?? {}).map(([id, value]) => [Number(id), value]))
  const progress = new Map(Object.entries(stats.data?.topic_progress ?? {}).map(([id, value]) => [Number(id), value]))
  return <StudySidebarShell overlayOnly drawerOpen setDrawerOpen={open => { if (!open) onClose() }}
    sidebarWidth={300} sidebarCollapsed={false} isResizing={false} handleSidebarResizeDown={() => {}}
    sidebarProps={{topics, topicCounts: counts, topicProgress: progress,
      topicSearch: state.topicSearch, setTopicSearch: state.setTopicSearch,
      selectedTopicId: null, isSmartReview: false, smartQueue: null,
      onSelect: id => { onClose(); state.selectTopic(id) },
      onSelectSmartReview: () => { onClose(); navigate(routes.smartReview) },
    }} />
}
