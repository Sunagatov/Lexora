import {useDeferredValue, useLayoutEffect, useSyncExternalStore} from 'react'
import {useLocation, useNavigate, useNavigationType} from 'react-router-dom'
import {languagePreferences, LEARNING_LANGUAGES, subscribeLanguages} from './api'
import {updatePreferences} from '@/features/preferences/api'

/** History entries remember the library their word/topic IDs belong to. */
export function LanguageRouteContext() {
  // Router 7 transitions navigation. Record language after that transition so a
  // synchronous preference update cannot replace the route being left behind.
  const preferences = useDeferredValue(useSyncExternalStore(subscribeLanguages, languagePreferences))
  const location = useLocation()
  const navigationType = useNavigationType()
  const navigate = useNavigate()

  useLayoutEffect(() => {
    if (location.pathname.startsWith('/account')) return
    const stored = location.state?.learningLanguage
    const language = LEARNING_LANGUAGES.find(item => item.code === stored)?.code
    if (navigationType === 'POP' && language && language !== preferences.language) {
      updatePreferences({language})
    } else if (language !== preferences.language) {
      navigate({pathname: location.pathname, search: location.search, hash: location.hash}, {
        replace: true, state: {...location.state, learningLanguage: preferences.language},
      })
    }
  }, [location, navigate, navigationType, preferences])

  return null
}
