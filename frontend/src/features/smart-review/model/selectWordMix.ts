import type {WordMixPreferences} from '@/features/preferences/api'
import type {Word} from '@/features/words/types/wordTypes'
import type {CefrLevel} from '@/features/words/model/wordDomain'

/** The caller supplies words from the current learning language. */
export function selectWordMix(words: Word[], preferences: WordMixPreferences, reviewedAt: Record<number, string> = {}, now = Date.now()): Word[] {
  const cutoff = now - preferences.cooldown_days * 86_400_000
  const candidates = words.filter(word => !word.deleted_at && word.is_active
    && preferences.levels.includes((Number(word.knowledge_level) === 2 ? 3 : word.knowledge_level) as 1 | 3 | 4 | 5)
    && (!preferences.cefr_levels.length || preferences.cefr_levels.includes(word.cefr_level as CefrLevel))
    && (!preferences.cooldown_days || !(Date.parse(reviewedAt[word.id]) >= cutoff)))
  function shuffle(items: Word[]) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]
    }
    return items
  }
  shuffle(candidates)
  if (!preferences.balance_topics) return candidates.slice(0, preferences.size)
  const buckets = new Map<number, Word[]>()
  for (const word of candidates) {
    const topicId = word.topic_ids.length ? Math.min(...word.topic_ids) : 0
    if (!buckets.has(topicId)) buckets.set(topicId, [])
    buckets.get(topicId)!.push(word)
  }
  const selected: Word[] = []
  while (buckets.size && selected.length < preferences.size) {
    for (const [topicId, bucket] of buckets) {
      selected.push(bucket.pop()!)
      if (!bucket.length) buckets.delete(topicId)
      if (selected.length === preferences.size) break
    }
  }
  return shuffle(selected)
}
