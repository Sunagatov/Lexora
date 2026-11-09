import {act, render, screen} from '@testing-library/react'
import {EasyPronunciation} from '../components/EasyPronunciation'
import type {Word} from '../types/wordTypes'
import {setPronunciationPreferences} from '@/features/languages/pronunciationPreferences'
import {DEFAULT_PREFERENCES, usePreferences} from '@/features/preferences/api'

vi.mock('@/features/preferences/api', async importOriginal => ({
  ...await importOriginal<typeof import('@/features/preferences/api')>(), usePreferences: vi.fn(),
}))
beforeEach(() => {
  setPronunciationPreferences({})
  vi.mocked(usePreferences).mockReturnValue(DEFAULT_PREFERENCES)
})
afterEach(() => setPronunciationPreferences({}))
const word = {language: 'en', pronunciation_ipa: '/ˈpeɪʃənt/', pronunciation_easy: null} as Word

it('renders existing English IPA by default with the correct notation metadata', () => {
  render(<EasyPronunciation word={word} />)
  const ipa = screen.getByText('/ˈpeɪʃənt/')
  expect(ipa.lang).toBe('und-fonipa')
  expect(ipa.title).toBe('International Phonetic Alphabet')
})
it('honors the explicit notation, missing data and the global visibility preference', () => {
  const {container, rerender} = render(<EasyPronunciation word={word} />)
  act(() => setPronunciationPreferences({en: 'easy'}))
  expect(container.textContent).toBe('')
  rerender(<EasyPronunciation word={{...word, pronunciation_easy: 'пе́йшэнт'}} />)
  expect(screen.getByText('пе́йшэнт').lang).toBe('ru')
  vi.mocked(usePreferences).mockReturnValue({...DEFAULT_PREFERENCES, pronunciation: false})
  rerender(<EasyPronunciation word={word} mode="ipa" />)
  expect(container.textContent).toBe('')
})
