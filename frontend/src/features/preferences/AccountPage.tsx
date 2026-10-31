import { useSyncExternalStore } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { useIsMutating } from '@tanstack/react-query'
import { routes } from '@/app/routes'
import { useLogoutAction } from '@/features/auth/hooks/useLogoutAction'
import { LEARNING_LANGUAGES, languageProfile } from '@/features/languages/api'
import type { PronunciationMode } from '@/features/languages/pronunciationPreferences'
import { StatsPage } from '@/features/stats/routes/StatsPage'
import { TrashPage } from '@/features/trash/routes/TrashPage'
import { AccountIcon } from './AccountIcon'
import { AccountData } from './AccountData'
import { AccountOffline } from './AccountOffline'
import { accountReturnTarget } from './accountNavigation'
import {
  DEFAULT_PREFERENCES,
  flushPreferences,
  preferencesSnapshot,
  subscribePreferences,
  updatePreferences,
  type Preferences,
} from './api'

const SECTIONS = [
  { id: 'languages', title: 'Languages', description: 'Learning and translation languages' },
  { id: 'study', title: 'Study preferences', description: 'Word lists, cards and gestures' },
  { id: 'appearance', title: 'Appearance', description: 'Theme and display preferences' },
  { id: 'statistics', title: 'Statistics', description: 'Progress and activity' },
  { id: 'data', title: 'Library & data', description: 'Import, export and Trash' },
  { id: 'offline', title: 'Offline', description: 'Saved copy and sync' },
]
type SwitchKey =
  | 'swipes'
  | 'pronunciation'
  | 'translations'
  | 'badges'
  | 'summary'
  | 'colours'
  | 'animations'
function Switch({
  name,
  label,
  help,
  values,
  saving,
}: {
  name: SwitchKey
  label: string
  help: string
  values: Preferences
  saving?: boolean
}) {
  return (
    <label className="account-row">
      <span>
        {label}
        <small>{help}</small>
      </span>
      <input
        className="account-toggle"
        type="checkbox"
        aria-label={label}
        disabled={saving}
        checked={values[name]}
        onChange={(event) => updatePreferences({ [name]: event.target.checked })}
      />
    </label>
  )
}

export function AccountPage() {
  const { section } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const snapshot = useSyncExternalStore(subscribePreferences, preferencesSnapshot)
  const { values } = snapshot
  const { logoutPending, handleLogout } = useLogoutAction()
  const mutationsPending = useIsMutating() > 0
  const mobile = useIsMobile(768)
  const selected = SECTIONS.find((item) => item.id === section)
  const title = section === 'trash' ? 'Trash' : (selected?.title ?? 'My Lexora')
  const goBack = () => {
    const target = accountReturnTarget(location.state, values.language)
    navigate(target.to, {state: target.state})
  }
  const state = location.state
  if (!section && !mobile) return <Navigate to="/account/study" replace state={state} />
  return (
    <div className={`account-layout${section ? ' account-has-section' : ''}`}>
      <nav className="account-nav" aria-label="My Lexora sections">
        <button className="account-back" onClick={goBack}>
          <AccountIcon name="back" />
          Back to words
        </button>
        <h2>My Lexora</h2>
        {SECTIONS.map((item) => (
          <Link
            key={item.id}
            to={`${routes.account}/${item.id}`}
            state={state}
            aria-current={
              section === item.id || (section === 'trash' && item.id === 'data')
                ? 'page'
                : undefined
            }
          >
            <AccountIcon name={item.id} />
            {item.title}
          </Link>
        ))}
        <button className="account-signout" disabled={logoutPending} onClick={handleLogout}>
          <AccountIcon name="logout" />
          {logoutPending ? 'Signing out…' : 'Sign out'}
        </button>
      </nav>
      <div className="account-content">
        <button
          className="account-mobile-back account-back"
          onClick={section ? () => navigate(routes.account, { state }) : goBack}
        >
          <AccountIcon name="back" />
          {section ? 'My Lexora' : 'Back to words'}
        </button>
        <div className="account-title">
          <h1>{title}</h1>
          {section === 'study' && <p>Shared across all learning languages</p>}
          {!section && <p>Your library. Your preferences.</p>}
        </div>
        {!section && (
          <div className="account-overview">
            {SECTIONS.map((item) => (
              <Link key={item.id} to={`${routes.account}/${item.id}`} state={state}>
                <AccountIcon name={item.id} />
                <span>
                  {item.title}
                  <small>
                    {item.id === 'languages'
                      ? `${languageProfile(values.language).name} · ${values.translation_language === 'ru' ? 'Russian' : 'English'} translations`
                      : item.id === 'study'
                        ? `${values.page_size} words · ${values.sort === 'level-asc' ? 'Weak → A1' : 'Custom sorting'}`
                        : item.description}
                  </small>
                </span>
                <AccountIcon name="next" />
              </Link>
            ))}
            <button
              className="account-signout account-mobile-signout"
              disabled={logoutPending}
              onClick={handleLogout}
            >
              <AccountIcon name="logout" />
              Sign out
            </button>
          </div>
        )}
        {section === 'languages' && (
          <div className="account-surface">
            <label className="account-row account-language-row">
              <span>
                Learning language<small>Your words, topics, Favorites and progress</small>
              </span>
              <select
                aria-label="Learning language"
                value={values.language}
                disabled={mutationsPending}
                onChange={(event) =>
                  updatePreferences({ language: event.target.value as Preferences['language'] })
                }
              >
                {LEARNING_LANGUAGES.map((language) => (
                  <option key={language.code} value={language.code}>
                    {language.icon} {language.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="account-row account-language-row">
              <span>
                Translation language<small>Saved translations and explanations</small>
              </span>
              <select
                aria-label="Translation language"
                value={values.translation_language}
                disabled={mutationsPending}
                onChange={(event) =>
                  updatePreferences({ translation_language: event.target.value as 'ru' | 'en' })
                }
              >
                <option value="ru">🇷🇺 Russian</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </label>
            <label className="account-row account-language-row">
              <span>
                Pronunciation display<small>For {languageProfile(values.language).name}</small>
              </span>
              <select
                aria-label="Pronunciation display"
                value={values.pronunciation_modes[values.language] ?? 'easy'}
                onChange={(event) =>
                  updatePreferences({
                    pronunciation_modes: {
                      [values.language]: event.target.value as PronunciationMode,
                    },
                  })
                }
              >
                <option value="easy">Russian reading hints</option>
                {values.language === 'zh' && <option value="pinyin">Pinyin with tones</option>}
                <option value="ipa">IPA (when available)</option>
              </select>
            </label>
          </div>
        )}
        {section === 'study' && (
          <>
            <div className="account-group-title">Word lists</div>
            <div className="account-surface">
              <div className="account-row">
                <span>
                  Words per page<small>Default when opening a list</small>
                </span>
                <div className="account-segments" aria-label="Default words per page">
                  {([50, 100, 200] as const).map((size) => (
                    <button
                      key={size}
                      aria-pressed={values.page_size === size}
                      onClick={() => updatePreferences({ page_size: size })}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <label className="account-row">
                <span>Default sorting</span>
                <select
                  aria-label="Default sorting"
                  value={values.sort}
                  onChange={(event) =>
                    updatePreferences({ sort: event.target.value as Preferences['sort'] })
                  }
                >
                  <option value="level-asc">Weak → A1</option>
                  <option value="level-desc">Strong first</option>
                  <option value="cefr-asc">A1 → C2</option>
                  <option value="cefr-desc">C2 → A1</option>
                  <option value="term-asc">A → Z</option>
                  <option value="term-desc">Z → A</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </label>
            </div>
            <div className="account-group-title">Cards & gestures</div>
            <div className="account-surface">
              <Switch
                name="swipes"
                label="Swipe gestures"
                help="Right: Strong · Left: Parked"
                values={values}
              />
              <Switch
                name="pronunciation"
                label="Pronunciation hints"
                help="Audio stays available"
                values={values}
              />
              <Switch
                name="translations"
                label="Translations on cards"
                help="Always available in word details"
                values={values}
              />
              <Switch
                name="badges"
                label="Word badges"
                help="Level and part of speech"
                values={values}
              />
            </div>
          </>
        )}
        {section === 'appearance' && (
          <div className="account-surface">
            <label className="account-row">
              <span>Theme</span>
              <select
                aria-label="Theme"
                value={values.theme}
                onChange={(event) =>
                  updatePreferences({ theme: event.target.value as Preferences['theme'] })
                }
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </label>
            <Switch
              name="summary"
              label="Progress summary"
              help="Bar and knowledge percentages"
              values={values}
            />
            <Switch
              name="colours"
              label="Knowledge colours"
              help="Card backgrounds and borders; labels stay visible"
              values={values}
            />
            <Switch
              name="animations"
              label="Animations"
              help="Subtle interaction feedback"
              values={values}
            />
          </div>
        )}
        {section === 'statistics' && <StatsPage embedded />}
        {section === 'trash' && <TrashPage embedded />}
        {section === 'data' && <AccountData />}
        {section === 'offline' && <AccountOffline />}
        {section && !selected && section !== 'trash' && (
          <p>
            Section not found. <Link to={routes.account}>Open My Lexora</Link>
          </p>
        )}
        {['study', 'languages', 'appearance'].includes(section ?? '') && (
          <div className="account-save-row">
            <span
              role="status"
              className={snapshot.status === 'error' ? 'account-error' : 'account-saved'}
            >
              <AccountIcon name="check" />
              {snapshot.status === 'saving'
                ? 'Saving…'
                : snapshot.status === 'error'
                  ? 'Saved on this device; sync needed'
                  : 'Saved'}
            </span>
            {section === 'study' && (
              <button
                className="account-text-button"
                onClick={() =>
                  updatePreferences({
                    page_size: DEFAULT_PREFERENCES.page_size,
                    sort: DEFAULT_PREFERENCES.sort,
                    swipes: true,
                    pronunciation: true,
                    translations: true,
                    badges: true,
                  })
                }
              >
                Restore study defaults
              </button>
            )}
          </div>
        )}
        {snapshot.status === 'error' && (
          <p className="account-error" role="alert">
            {snapshot.error}{' '}
            <button
              className="account-text-button"
              onClick={() => {
                void flushPreferences()
              }}
            >
              Retry sync
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
