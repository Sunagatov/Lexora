import {useEffect, useRef, useState, useSyncExternalStore} from 'react'
import {createPortal} from 'react-dom'
import {useIsMutating} from '@tanstack/react-query'
import {useLocation, useNavigate} from 'react-router-dom'
import {languagePreferences, languageProfile, LEARNING_LANGUAGES, setLanguagePreferences, subscribeLanguages, type LanguagePreferences} from './api'
import {pronunciationPreferences, setPronunciationPreferences, type PronunciationMode} from './pronunciationPreferences'

function LanguageDialog({onClose}: {onClose: () => void}) {
  const [draft, setDraft] = useState(languagePreferences)
  const [readings, setReadings] = useState(pronunciationPreferences)
  const ref = useRef<HTMLDialogElement>(null)
  const navigate = useNavigate()
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return createPortal(<dialog ref={ref} className="language-dialog" aria-labelledby="language-title" onCancel={onClose}>
    <h2 id="language-title">Languages</h2>
    <label>Learning language<select aria-label="Learning language" value={draft.language}
      onChange={event => setDraft({...draft, language: event.target.value as LanguagePreferences['language']})}>
      {LEARNING_LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.icon} {language.name}</option>)}
    </select></label>
    <label>Translations and explanations<select aria-label="Translation language" value={draft.translationLanguage}
      onChange={event => setDraft({...draft, translationLanguage: event.target.value as 'ru' | 'en'})}>
      <option value="ru">🇷🇺 Russian</option><option value="en">🇬🇧 English</option>
    </select></label>
    <label>Pronunciation<select aria-label="Pronunciation display" value={readings[draft.language] ?? 'easy'}
      onChange={event => setReadings({...readings, [draft.language]: event.target.value as PronunciationMode})}>
      <option value="easy">Russian reading hints</option>
      {draft.language === 'zh' && <option value="pinyin">Pinyin with tones</option>}
      <option value="ipa">IPA (when available)</option>
    </select></label>
    <div className="modal-actions"><button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => {
        setPronunciationPreferences(readings)
        const current = languagePreferences()
        if (draft.language !== current.language || draft.translationLanguage !== current.translationLanguage) {
          setLanguagePreferences(draft)
          if (draft.language !== current.language) navigate('/')
        }
        onClose()
      }}>Done</button></div>
  </dialog>, document.body)
}

export function LanguagePicker() {
  const preferences = useSyncExternalStore(subscribeLanguages, languagePreferences)
  const profile = languageProfile(preferences.language)
  const [open, setOpen] = useState(false)
  const pending = useIsMutating() > 0
  const editing = useLocation().pathname.endsWith('/edit')
  return <><button type="button" className="language-picker" disabled={pending || editing}
    aria-label={'Choose languages. Learning ' + profile.name} title={editing ? 'Finish editing before changing languages' : profile.name}
    onClick={() => setOpen(true)}><span aria-hidden="true">{profile.icon}</span><span className="language-picker-full">{profile.name}</span><span className="language-picker-short">{profile.code.toUpperCase()}</span><span aria-hidden="true">⌄</span></button>
    {open && <LanguageDialog onClose={() => setOpen(false)} />}</>
}
