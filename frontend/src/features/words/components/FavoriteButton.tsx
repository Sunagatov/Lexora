import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query'
import { AccountIcon } from '@/features/preferences/AccountIcon'
import { updateWord, type WordListResponse } from '@/features/words/api/wordsApi'
import type { Word } from '@/features/words/types/wordTypes'
import type { StudyQueue } from '@/features/smart-review/types/studyQueueTypes'
import { queryKeys } from '@/app/queryKeys'

type FavoriteChange = {wordId: number; isFavorite: boolean}

export function FavoriteButton({ word }: { word: Word }) {
  const client = useQueryClient()
  const mutationKey = ['word-favorite', word.id]
  const pendingValues = useMutationState({
    filters: {mutationKey, exact: true, status: 'pending'},
    select: item => (item.state.variables as FavoriteChange).isFavorite,
  })
  const pending = pendingValues.length > 0
  const isFavorite = pending ? pendingValues[pendingValues.length - 1] : !!word.is_favorite
  function patchFavorite(wordId: number, isFavorite: boolean) {
    // Patch only this flag: a simultaneous rating must not get overwritten.
    const patch = (item: Word) =>
      item.id === wordId ? { ...item, is_favorite: isFavorite } : item
    client.setQueryData<Word>(queryKeys.word(wordId), (current) =>
      current ? patch(current) : current,
    )
    client.setQueriesData<Word[]>({ queryKey: queryKeys.words }, (current) => current?.map(patch))
    client.setQueriesData<WordListResponse>({ queryKey: queryKeys.wordList }, (current) =>
      current ? { ...current, words: current.words.map(patch) } : current,
    )
    client.setQueryData<StudyQueue>(queryKeys.smartReview, (current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => ({ ...item, word: patch(item.word) })),
          }
        : current,
    )
  }
  const mutation = useMutation({
    mutationKey,
    mutationFn: ({wordId, isFavorite}: FavoriteChange) => updateWord(wordId, {is_favorite: isFavorite}),
    onMutate: async ({wordId, isFavorite}) => {
      // In-flight reads must not replace the optimistic flag with older data.
      await Promise.all([queryKeys.word(wordId), queryKeys.words, queryKeys.wordList, queryKeys.smartReview]
        .map(queryKey => client.cancelQueries({queryKey})))
      patchFavorite(wordId, isFavorite)
    },
    onSuccess: (updated, {wordId}) => {
      patchFavorite(wordId, !!updated.is_favorite)
      // Leave the visible page intact until navigation/filtering, as requested.
      void client.invalidateQueries({ queryKey: queryKeys.wordList, refetchType: 'none' })
      void client.invalidateQueries({ queryKey: queryKeys.wordSummary })
    },
    onError: (_error, {wordId, isFavorite}) => {
      patchFavorite(wordId, !isFavorite)
    },
  })
  return (
    <span className="favorite-control">
      <button
        type="button"
        className={`word-favorite${isFavorite ? ' is-favorite' : ''}`}
        aria-pressed={isFavorite}
        aria-busy={pending}
        aria-label={`${isFavorite ? 'Remove' : 'Add'} ${word.term} ${isFavorite ? 'from' : 'to'} Favorites`}
        disabled={pending}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          // React may not have rendered disabled yet; also guard other visible
          // controls for this same word to prevent concurrent stale toggles.
          if (client.isMutating({mutationKey, exact: true})) return
          mutation.mutate({wordId: word.id, isFavorite: !isFavorite})
        }}
      >
        <AccountIcon name="heart" />
      </button>
      {mutation.isError && (
        <span role="alert" className="favorite-error">
          Not saved. Try again.
        </span>
      )}
    </span>
  )
}
