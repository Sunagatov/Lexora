import {formatIpa} from '@/features/words/model/wordPresenter'

it.each([
  ['pɪɡ', '/pɪɡ/'], ['/pɪɡ/', '/pɪɡ/'], ['//pɪɡ//', '/pɪɡ/'],
  [' /pɪɡ/ ', '/pɪɡ/'], ['[pɪɡ]', '[pɪɡ]'], ['', ''], ['//', ''],
])('formats IPA %j as %j', (value, expected) => {
  expect(formatIpa(value)).toBe(expected)
})
