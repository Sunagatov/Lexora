import { expect, it } from 'vitest'
import { accountReturnTarget } from './accountNavigation'

it('opens the new library instead of restoring filters and IDs from a different language', () => {
  expect(
    accountReturnTarget(
      {
        returnLanguage: 'en',
        returnTo: '/topics/people?page=2',
        returnScrollTop: 320,
        returnState: { wordList: { ids: [1, 2] } },
      },
      'de',
    ),
  ).toEqual({
    to: '/',
    state: { learningLanguage: 'de', wordListScrollTop: 0 },
  })
})

it('falls back to All words when no previous list exists or the target is invalid', () => {
  for (const state of [null, { returnTo: '//example.com' }, { returnTo: '/account/study' }]) {
    expect(accountReturnTarget(state, 'en').to).toBe('/')
  }
})
