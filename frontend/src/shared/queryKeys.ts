export const queryKeys = {
  topics:      ['topics']                        as const,
  words:       ['words']                         as const,
  topicWords:  (id: number) => ['words', id]     as const,
  word:        (id: number) => ['word', id]      as const,
  trashWords:  ['trash-words']                   as const,
  trashTopics: ['trash-topics']                  as const,
  stats:       ['stats']                         as const,
  smartReview: ['smart-review']                  as const,
}
