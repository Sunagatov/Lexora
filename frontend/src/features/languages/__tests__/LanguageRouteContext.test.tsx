import {act, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MemoryRouter, useLocation, useNavigate} from 'react-router-dom'
import {useSyncExternalStore} from 'react'
import {LanguageRouteContext} from '../LanguageRouteContext'
import {languagePreferences, onLanguageChange, setLanguagePreferences, subscribeLanguages} from '../api'

afterEach(() => {onLanguageChange(() => {});setLanguagePreferences({language: 'en', translationLanguage: 'ru'})})

function Probe() {
  const preferences = useSyncExternalStore(subscribeLanguages, languagePreferences)
  const location = useLocation()
  const navigate = useNavigate()
  return <><LanguageRouteContext /><p>{preferences.language} {location.pathname}</p>
    <button onClick={() => navigate(-1)}>Back</button><button onClick={() => navigate(1)}>Forward</button>
    <button onClick={() => {setLanguagePreferences({...preferences, language: 'fr'});navigate('/')}}>French</button>
  </>
}

it('restores the correct library on browser Back and Forward', async () => {
  onLanguageChange(() => {})
  setLanguagePreferences({language: 'es', translationLanguage: 'ru'})
  render(<MemoryRouter initialEntries={[
    {pathname: '/words/1', state: {learningLanguage: 'zh'}},
    {pathname: '/', state: {learningLanguage: 'es'}},
  ]} initialIndex={1}><Probe /></MemoryRouter>)
  fireEvent.click(screen.getByText('Back'))
  await waitFor(() => expect(screen.getByText('zh /words/1')).toBeTruthy())
  fireEvent.click(screen.getByText('Forward'))
  await waitFor(() => expect(screen.getByText('es /')).toBeTruthy())
})

it('records new entries and does not revert an explicit language change', async () => {
  onLanguageChange(() => {})
  setLanguagePreferences({language: 'en', translationLanguage: 'ru'})
  render(<MemoryRouter initialEntries={['/words/1']}><Probe /></MemoryRouter>)
  await act(async () => {})
  fireEvent.click(screen.getByText('French'))
  await waitFor(() => expect(screen.getByText('fr /')).toBeTruthy())
  fireEvent.click(screen.getByText('Back'))
  await waitFor(() => expect(screen.getByText('en /words/1')).toBeTruthy())
})
