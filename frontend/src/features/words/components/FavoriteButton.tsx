import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AccountIcon } from '@/features/preferences/AccountIcon'
import { updateWord, type WordListResponse } from '@/features/words/api/wordsApi'
import type { Word } from '@/features/words/types/wordTypes'
import type { StudyQueue } from '@/features/smart-review/types/studyQueueTypes'
import { queryKeys } from '@/app/queryKeys'

export function FavoriteButton({ word }: { word: Word }) {
  const client = useQueryClient()
  const [error, setError] = useState(false)
  const mutation = useMutation({
    mutationFn: () => updateWord(word.id, { is_favorite: !word.is_favorite }),
    onMutate: () => setError(false),
    onSuccess: (updated) => {
      // Patch only this flag: a simultaneous rating must not get overwritten.
      const patch = (item: Word) =>
        item.id === word.id ? { ...item, is_favorite: updated.is_favorite } : item
      client.setQueryData<Word>(queryKeys.word(word.id), (current) =>
        current ? patch(current) : updated,
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
      // Leave the visible page intact until navigation/filtering, as requested.
      void client.invalidateQueries({ queryKey: queryKeys.wordList, refetchType: 'none' })
      void client.invalidateQueries({ queryKey: queryKeys.wordSummary })
    },
    onError: () => setError(true),
  })
  return (
    <span className="favorite-control">
      <button
        type="button"
        className={`word-favorite${word.is_favorite ? ' is-favorite' : ''}`}
        aria-pressed={!!word.is_favorite}
        aria-label={`${word.is_favorite ? 'Remove' : 'Add'} ${word.term} ${word.is_favorite ? 'from' : 'to'} Favorites`}
        disabled={mutation.isPending}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          mutation.mutate()
        }}
      >
        <AccountIcon name="heart" />
      </button>
      {error && (
        <span role="alert" className="favorite-error">
          Not saved. Try again.
        </span>
      )}
    </span>
  )
}
