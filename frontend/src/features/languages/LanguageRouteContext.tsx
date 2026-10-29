import {useLayoutEffect, useSyncExternalStore} from 'react'
import {useLocation, useNavigate, useNavigationType} from 'react-router-dom'
import {languagePreferences, LEARNING_LANGUAGES, setLanguagePreferences, subscribeLanguages} from './api'

/** History entries remember the library their word/topic IDs belong to. */
export function LanguageRouteContext() {
  const preferences = useSyncExternalStore(subscribeLanguages, languagePreferences)
  const location = useLocation()
  const navigationType = useNavigationType()
  const navigate = useNavigate()

  useLayoutEffect(() => {
    const stored = location.state?.learningLanguage
    const language = LEARNING_LANGUAGES.find(item => item.code === stored)?.code
    if (navigationType === 'POP' && language && language !== preferences.language) {
      setLanguagePreferences({...preferences, language})
    } else if (language !== preferences.language) {
      navigate({pathname: location.pathname, search: location.search, hash: location.hash}, {
        replace: true, state: {...location.state, learningLanguage: preferences.language},
      })
    }
  }, [location, navigate, navigationType, preferences])

  return null
}
