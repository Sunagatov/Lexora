import {useEffect, useRef, useState} from 'react'
import {CEFR_LEVELS, LEVEL_LABELS, LEVELS} from '@/features/words/model/wordDomain'
import {updatePreferences, type WordMixPreferences} from './api'
import {useWordMixView} from './useWordMixView'

export function AccountWordMix({preferences}: {preferences: WordMixPreferences}) {
  const [view, selectView] = useWordMixView()
  const [size, setSize] = useState(String(preferences.size))
  const [sizeError, setSizeError] = useState('')
  const sizeEdited = useRef(false)
  useEffect(() => {
    if (!sizeEdited.current) { setSize(String(preferences.size)); setSizeError('') }
  }, [preferences.size])

  function save(patch: Partial<WordMixPreferences>) {
    updatePreferences({word_mix: patch})
  }
  function saveSize() {
    const value = Number(size)
    if (!Number.isInteger(value) || value < 1 || value > 1000) {
      setSizeError('Enter a whole number from 1 to 1,000.')
      return
    }
    sizeEdited.current = false
    setSize(String(value))
    setSizeError('')
    if (value !== preferences.size) save({size: value})
  }
  const cooldownOptions = [...new Set([0, 1, 3, 7, 14, 30, preferences.cooldown_days])].sort((a, b) => a - b)

  return <div className="account-word-mix">
    <section className="account-surface" aria-labelledby="mix-view-title">
      <h2 className="account-card-title" id="mix-view-title">Review view</h2>
      <div className="account-row account-mix-row">
        <span>Word mix view<small>Choose how Daily Word Mix opens on this device.</small></span>
        <div className="account-segments" role="group" aria-label="Word mix view">
          <button type="button" aria-pressed={view === 'list'} onClick={() => selectView('list')}>List</button>
          <button type="button" aria-pressed={view === 'swipe'} onClick={() => selectView('swipe')}>Swipe</button>
        </div>
      </div>
    </section>
    <section className="account-surface" aria-labelledby="mix-size-title">
      <h2 className="account-card-title" id="mix-size-title">Set size</h2>
      <div className="account-row account-mix-row">
        <span>Words per set<small>A new set can be smaller when fewer words match.</small></span>
        <div className="account-mix-size-controls">
          <div className="account-segments" role="group" aria-label="Word mix size presets">
            {[50, 100, 200, 500].map(value => <button type="button" key={value}
              aria-pressed={preferences.size === value} onClick={() => {sizeEdited.current = false; setSize(String(value)); setSizeError(''); save({size: value})}}>{value}</button>)}
          </div>
          <label className="account-mix-custom"><span>Custom</span><input type="number" min="1" max="1000" step="1" aria-label="Custom word mix size"
            aria-invalid={!!sizeError} aria-describedby={sizeError ? 'mix-size-error' : undefined}
            value={size} onChange={event => {sizeEdited.current = true; setSize(event.target.value); setSizeError('')}}
            onBlur={saveSize} onKeyDown={event => {
              if (event.key === 'Enter') event.currentTarget.blur()
              if (event.key === 'Escape') {sizeEdited.current = false; setSize(String(preferences.size)); setSizeError('')}
            }} /></label>
        </div>
      </div>
      {sizeError && <p className="account-mix-error" id="mix-size-error" role="alert">{sizeError}</p>}
    </section>
    <section className="account-surface" aria-labelledby="mix-words-title">
      <h2 className="account-card-title" id="mix-words-title">Which words to include</h2>
      <div className="account-row account-mix-row">
        <span>Knowledge levels<small>Select at least one level.</small></span>
        <div className="account-mix-choices" role="group" aria-label="Word mix knowledge levels">
          {LEVELS.map(level => {
            const selected = preferences.levels.includes(level)
            return <button type="button" key={level} aria-pressed={selected}
              disabled={selected && preferences.levels.length === 1}
              onClick={() => save({levels: selected ? preferences.levels.filter(value => value !== level) : [...preferences.levels, level]})}>
              <span className={`account-mix-dot level-${level}`} aria-hidden="true" />{LEVEL_LABELS[level]}
            </button>
          })}
        </div>
      </div>
      <div className="account-row account-mix-row">
        <span>CEFR levels<small>All levels also includes words without a CEFR label.</small></span>
        <div className="account-mix-choices" role="group" aria-label="Word mix CEFR levels">
          <button type="button" aria-pressed={!preferences.cefr_levels.length} onClick={() => save({cefr_levels: []})}>All levels</button>
          {CEFR_LEVELS.map(level => <button type="button" key={level} aria-pressed={preferences.cefr_levels.includes(level)}
            onClick={() => save({cefr_levels: preferences.cefr_levels.includes(level)
              ? preferences.cefr_levels.filter(value => value !== level) : [...preferences.cefr_levels, level]})}>{level}</button>)}
        </div>
      </div>
      <div className="account-row account-mix-row">
        <span>Topics<small>Always drawn from the learning language you are practising.</small></span>
        <span className="account-mix-value">All topics</span>
      </div>
    </section>
    <section className="account-surface" aria-labelledby="mix-variety-title">
      <h2 className="account-card-title" id="mix-variety-title">Variety</h2>
      <label className="account-row">
        <span>Avoid recent repeats<small>Skip words you rated in a recent mix.</small></span>
        <select aria-label="Avoid recent repeats" value={preferences.cooldown_days}
          onChange={event => save({cooldown_days: Number(event.target.value)})}>
          {cooldownOptions.map(days => <option value={days} key={days}>{days === 0 ? 'Off' : `${days} ${days === 1 ? 'day' : 'days'}`}</option>)}
        </select>
      </label>
      <label className="account-row">
        <span>Balance across topics<small>Spread the set across topics where possible.</small></span>
        <input type="checkbox" className="account-toggle" aria-label="Balance across topics" checked={preferences.balance_topics}
          onChange={event => save({balance_topics: event.target.checked})} />
      </label>
    </section>
    <p className="account-help">Set size, word selection and variety changes apply to your next new set. Your current set stays as it is.</p>
  </div>
}
