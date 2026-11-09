import {useRef, useState} from 'react'
import {fireEvent, render, screen} from '@testing-library/react'
import {SortMenu} from '../components/TopicSortMenu'

function Harness() {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  return <div onKeyDown={event => {if (event.key === 'Escape') throw new Error('Escape leaked to drawer')}}>
    <button ref={anchor} onClick={() => setOpen(true)}>Sort</button>
    {open && <SortMenu anchorRef={anchor} options={[{value: 'weakest', label: 'Weakest first'}, {value: 'az', label: 'A to Z'}]}
      current="weakest" onSelect={() => setOpen(false)} onClose={() => setOpen(false)} />}
  </div>
}

it('focuses the current sort, supports arrows, closes only the menu and restores focus', () => {
  render(<Harness />)
  const trigger = screen.getByRole('button', {name: 'Sort'})
  fireEvent.click(trigger)
  const current = screen.getByRole('menuitemradio', {name: 'Weakest first'})
  expect(document.activeElement).toBe(current)
  fireEvent.keyDown(current, {key: 'ArrowDown'})
  expect(document.activeElement).toBe(screen.getByRole('menuitemradio', {name: 'A to Z'}))
  fireEvent.keyDown(document.activeElement!, {key: 'Escape'})
  expect(screen.queryByRole('dialog', {name: 'Sort topics'})).toBeNull()
  expect(document.activeElement).toBe(trigger)
})
