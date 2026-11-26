import { useCallback, useSyncExternalStore } from 'react'
import { notifyManager, useMutation, useQueryClient } from '@tanstack/react-query'
import { AccountIcon } from '@/features/preferences/AccountIcon'
import { updateWord, type WordSummaryParams } from '@/features/words/api/wordsApi'
import { patchWordFavorite } from '@/features/words/model/wordCache'
import type { Word } from '@/features/words/types/wordTypes'
import { queryKeys } from '@/app/queryKeys'

type FavoriteChange = {wordId: number; isFavorite: boolean}
const FAVORITE_KEY = 'word-favorite'

export function FavoriteButton({ word }: { word: Word }) {
  const client = useQueryClient()
  const cache = client.getMutationCache()
  const wordId = word.id
  const mutationKey = [FAVORITE_KEY, wordId]
  const subscribe = useCallback((notify: () => void) => {
    const notifySettled = notifyManager.batchCalls(notify)
    return cache.subscribe(event => {
      // Limit notifications to saves for this word.
      if (event.type !== 'updated' && event.type !== 'removed') return
      const key = event.mutation.options.mutationKey
      if (key?.[0] !== FAVORITE_KEY || key[1] !== wordId) return
      if (event.type === 'updated' && event.action.type === 'pending') notify()
      // Let the confirmed word reach the list before removing the optimistic flag.
      else notifySettled()
    })
  }, [cache, wordId])
  function pendingFavorite() {
    return cache.find<Word, Error, FavoriteChange>({mutationKey, status: 'pending'})?.state.variables?.isFavorite
  }
  const optimistic = useSyncExternalStore(subscribe, pendingFavorite)
  const pending = optimistic !== undefined
  const isFavorite = optimistic ?? !!word.is_favorite

  const mutation = useMutation({
    mutationKey,
    mutationFn: ({wordId, isFavorite}: FavoriteChange) => updateWord(wordId, {is_favorite: isFavorite}),
    onSuccess: async (updated, {wordId}) => {
      // The pending flag gives instant feedback. Touch the word caches once,
      // when the save is confirmed, and prevent older reads from replacing it.
      await Promise.all([queryKeys.word(wordId), queryKeys.words, queryKeys.wordList, queryKeys.smartReview]
        .map(queryKey => client.cancelQueries({
          queryKey, fetchStatus: 'fetching', predicate: query => query.state.data !== undefined,
        })))
      patchWordFavorite(client, wordId, !!updated.is_favorite)
      const favoriteScope = ({queryKey}: {queryKey: readonly unknown[]}) =>
        (queryKey[1] as WordSummaryParams | undefined)?.favoritesOnly === true
      // Leave the visible page intact until navigation/filtering, as requested.
      void client.invalidateQueries({queryKey: queryKeys.wordList, predicate: favoriteScope, refetchType: 'none'})
      void client.invalidateQueries({queryKey: queryKeys.wordSummary, predicate: favoriteScope})
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
          if (pendingFavorite() !== undefined) return
          mutation.mutate({wordId, isFavorite: !isFavorite})
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
