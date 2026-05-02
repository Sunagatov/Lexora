import type {QueryClient} from '@tanstack/react-query'
import {queryKeys} from '@/app/queryKeys'
import type {Topic} from '@/features/topics/types/topicTypes'

const TOPIC_DEPENDENT_QUERY_KEYS = [
  queryKeys.topics,
  queryKeys.words,
  queryKeys.topicSidebar,
  queryKeys.stats,
  queryKeys.smartReview,
] as const

const TOPIC_TRASH_QUERY_KEYS = [
  queryKeys.trashWords,
  queryKeys.trashTopics,
] as const

export function appendTopicToLists(queryClient: QueryClient, created: Topic): void {
  queryClient.setQueryData<Topic[]>(queryKeys.topics, (current = []) => [...current, created])
}

export function replaceTopicInLists(queryClient: QueryClient, updated: Topic): void {
  queryClient.setQueryData<Topic[]>(queryKeys.topics, (current = []) =>
    current.map((topic) => (topic.id === updated.id ? updated : topic)),
  )
}

export function removeTopicFromTrashLists(queryClient: QueryClient, topicId: number): void {
  queryClient.setQueryData<Topic[]>(queryKeys.trashTopics, (current = []) =>
    current.filter((topic) => topic.id !== topicId),
  )
}

export async function invalidateTopicDependencies(
  queryClient: QueryClient,
  extras: readonly (readonly unknown[])[] = [],
): Promise<void> {
  await Promise.all(
    [...TOPIC_DEPENDENT_QUERY_KEYS, ...extras].map((queryKey) =>
      queryClient.invalidateQueries({queryKey}),
    ),
  )
}

export async function invalidateTopicTrashDependencies(queryClient: QueryClient): Promise<void> {
  await invalidateTopicDependencies(queryClient, TOPIC_TRASH_QUERY_KEYS)
}
