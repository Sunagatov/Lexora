import {displayTranslations, languagePreferences, languageProfile, LEARNING_LANGUAGES, onLanguageChange, setLanguagePreferences} from '../api'
import {changeItem} from '@/features/offline/changes'
import {listWords, sidebarStats} from '@/features/offline/collections'
import type {Replica} from '@/features/offline/types'

afterEach(() => { onLanguageChange(() => {}); setLanguagePreferences({language: 'en', translationLanguage: 'ru'}) })

it('provides all nine learning languages and Arabic direction', () => {
  expect(LEARNING_LANGUAGES.map(item => item.code)).toEqual(['en', 'zh', 'es', 'de', 'tr', 'tt', 'ar', 'fr', 'pt'])
  expect(languageProfile('ar')).toMatchObject({direction: 'rtl', locale: 'ar-SA'})
  expect(languageProfile('zh').locale).toBe('zh-CN')
})

it('switches translation display without mutating or losing either saved group', () => {
  const word = {id: 1, language: 'es', translation_entries: ['хлеб'], definition: 'Из муки', notes: null,
    translation_groups: {ru: ['хлеб'], en: ['bread']}, explanation_groups: {ru: {definition: 'Из муки'}, en: {definition: 'A food'}}}
  setLanguagePreferences({language: 'es', translationLanguage: 'en'})
  expect(displayTranslations(word)).toMatchObject({translation_entries: ['bread'], definition: 'A food'})
  expect(word.translation_entries).toEqual(['хлеб'])
  setLanguagePreferences({language: 'es', translationLanguage: 'ru'})
  expect(displayTranslations(word)).toMatchObject({translation_entries: ['хлеб'], definition: 'Из муки'})
})

it('does not label the Russian content as English when an English version is absent', () => {
  setLanguagePreferences({language: 'en', translationLanguage: 'en'})
  expect(displayTranslations({id: 1, language: 'en', translation_entries: ['кот'], definition: 'A cat'}))
    .toMatchObject({translation_entries: [], definition: null, notes: null})
})

it('invalidates scoped data once and remembers the last preferences', () => {
  const changed = vi.fn()
  onLanguageChange(changed)
  setLanguagePreferences({language: 'tt', translationLanguage: 'ru'})
  expect(changed).toHaveBeenCalledOnce()
  expect(JSON.parse(localStorage.getItem('lexora-language-preferences')!)).toEqual(languagePreferences())
})

it('keeps offline CRUD, topic names, search, counts and translations separate', () => {
  const replica: Replica = {version: 1, savedAt: 'today', nextId: -1, changes: [], words: [], topics: []}
  changeItem(replica, 'topic', 'create', -1, {name: 'General'})
  changeItem(replica, 'word', 'create', -1, {term: 'Gift', topic_ids: [-1], knowledge_level: 4, translation_entries: ['подарок']})
  setLanguagePreferences({language: 'de', translationLanguage: 'ru'})
  changeItem(replica, 'topic', 'create', -1, {name: 'General'})
  changeItem(replica, 'word', 'create', -1, {term: 'Gift', topic_ids: [-3], knowledge_level: 1, translation_entries: ['яд']})
  expect(listWords(replica, new URLSearchParams()).words.map(word => word.id)).toEqual([-4])
  expect(sidebarStats(replica).total_words).toBe(1)
  expect(() => changeItem(replica, 'word', 'update', -2, {knowledge_level: 1})).toThrow('not found')
  setLanguagePreferences({language: 'de', translationLanguage: 'en'})
  changeItem(replica, 'word', 'update', -4, {translation_entries: ['poison'], translation_language: 'en', definition: 'A toxic substance'})
  expect(listWords(replica, new URLSearchParams('search=poison')).total).toBe(1)
  expect(listWords(replica, new URLSearchParams('search=яд')).total).toBe(0)
  expect(replica.words[1].translation_groups).toEqual({ru: ['яд'], en: ['poison']})
  expect(replica.words[1].explanation_groups?.en?.definition).toBe('A toxic substance')
  expect(replica.words[0].knowledge_level).toBe(4)
})

it.each(['问候', 'التحيات', 'Сәламләшү'])('accepts native-script topic names: %s', name => {
  const replica: Replica = {version: 1, savedAt: 'today', nextId: -1, changes: [], words: [], topics: []}
  changeItem(replica, 'topic', 'create', -1, {name})
  expect(replica.topics[0].slug).not.toBe('')
})

it('includes a null pinyin baseline for offline-created words and legacy copies', () => {
  setLanguagePreferences({language: 'zh', translationLanguage: 'ru'})
  const replica: Replica = {version: 1, savedAt: 'today', nextId: -1, changes: [], words: [], topics: []}
  changeItem(replica, 'topic', 'create', -1, {name: 'Greetings'})
  changeItem(replica, 'word', 'create', -1, {term: '你好', topic_ids: [-1], translation_entries: ['привет']})
  expect(replica.words[0].transliteration).toBeNull()
  delete replica.words[0].transliteration
  changeItem(replica, 'word', 'update', -2, {transliteration: 'nǐ hǎo'})
  expect(replica.changes[replica.changes.length - 1].before.transliteration).toBeNull()
  expect(replica.changes[replica.changes.length - 1].data.transliteration).toBe('nǐ hǎo')
})
