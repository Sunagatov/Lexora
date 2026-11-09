// Serialize edits and ratings for the same word across list/detail mutations.
// An older request must finish before a newer edit is sent to the server.
const pending = new Map<number, Promise<unknown>>()

export function enqueueWordWrite<T>(wordId: number, write: () => Promise<T>): Promise<T> {
  const previous = pending.get(wordId)
  const result = previous ? previous.catch(() => {}).then(write) : write()
  pending.set(wordId, result)
  void result.finally(() => {
    if (pending.get(wordId) === result) pending.delete(wordId)
  }).catch(() => {})
  return result
}
