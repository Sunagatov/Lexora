export const LEARNING_LANGUAGES = [
  {code: 'en', name: 'English', locale: 'en-GB', direction: 'ltr', icon: '🇬🇧', favicon: new URL('../../assets/flags/en.png', import.meta.url).href},
  {code: 'zh', name: 'Mandarin Chinese', locale: 'zh-CN', direction: 'ltr', icon: '🇨🇳', favicon: new URL('../../assets/flags/zh.png', import.meta.url).href},
  {code: 'es', name: 'Spanish', locale: 'es-ES', direction: 'ltr', icon: '🇪🇸', favicon: new URL('../../assets/flags/es.png', import.meta.url).href},
  {code: 'de', name: 'German', locale: 'de-DE', direction: 'ltr', icon: '🇩🇪', favicon: new URL('../../assets/flags/de.png', import.meta.url).href},
  {code: 'tr', name: 'Turkish', locale: 'tr-TR', direction: 'ltr', icon: '🇹🇷', favicon: new URL('../../assets/flags/tr.png', import.meta.url).href},
  {code: 'tt', name: 'Tatar', locale: 'tt-RU', direction: 'ltr', icon: '🇷🇺', favicon: new URL('../../assets/flags/tt.png', import.meta.url).href},
  {code: 'ar', name: 'Arabic', locale: 'ar-SA', direction: 'rtl', icon: '🇸🇦', favicon: new URL('../../assets/flags/ar.png', import.meta.url).href},
  {code: 'fr', name: 'French', locale: 'fr-FR', direction: 'ltr', icon: '🇫🇷', favicon: new URL('../../assets/flags/fr.png', import.meta.url).href},
  {code: 'pt', name: 'Portuguese', locale: 'pt-PT', direction: 'ltr', icon: '🇵🇹', favicon: new URL('../../assets/flags/pt.png', import.meta.url).href},
] as const
export type LearningLanguage = typeof LEARNING_LANGUAGES[number]['code']
export type LanguagePreferences = {language: LearningLanguage; translationLanguage: 'ru' | 'en'}
const key = 'lexora-language-preferences'
const listeners = new Set<() => void>()
let onChange: () => void = () => {}
function read(): LanguagePreferences {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? '{}')
    return {language: LEARNING_LANGUAGES.some(item => item.code === value.language) ? value.language : 'en',
      translationLanguage: value.translationLanguage === 'en' ? 'en' : 'ru'}
  } catch { return {language: 'en', translationLanguage: 'ru'} }
}
let preferences = read()
export const languagePreferences = () => preferences
export const languageProfile = (code: string = preferences.language) => LEARNING_LANGUAGES.find(item => item.code === code) ?? LEARNING_LANGUAGES[0]
export function subscribeLanguages(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }
export function onLanguageChange(callback: () => void) { onChange = callback }
export function setLanguagePreferences(value: LanguagePreferences) {
  preferences = value
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Preferences still work in this tab. */ }
  onChange()
  listeners.forEach(listener => listener())
}

// The saved copy retains all translation groups. Only the displayed entries vary.
export function displayTranslations(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(displayTranslations)
  if (!value || typeof value !== 'object') return value
  const object = value as Record<string, unknown>
  const result = Object.fromEntries(Object.entries(object).map(([key, child]) => [key, displayTranslations(child)]))
  if (typeof object.id === 'number' && typeof object.language === 'string' && Array.isArray(object.translation_entries)) {
    const groups = (object.translation_groups ?? {ru: object.translation_entries}) as Record<string, string[]>
    result.translation_groups = groups
    result.translation_entries = groups[preferences.translationLanguage] ?? []
    result.translation_language = preferences.translationLanguage
    const explanations = (object.explanation_groups ?? {ru: {definition: object.definition, notes: object.notes}}) as Record<string, Record<string, unknown>>
    result.explanation_groups = explanations
    result.definition = explanations[preferences.translationLanguage]?.definition ?? null
    result.notes = explanations[preferences.translationLanguage]?.notes ?? null
  }
  return result
}
