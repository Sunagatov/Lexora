export const routes = {
  home:        '/',
  login:       '/login',
  smartReview: '/smart-review',
  allWords:    '/words',
  trash:       '/trash',
  stats:       '/stats',
  topic:       (slug: string) => `/topics/${slug}`,
  word:        (id: number)   => `/words/${id}`,
  editWord:    (id: number)   => `/words/${id}/edit`,
}
