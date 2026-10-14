import {fireEvent, render, screen} from '@testing-library/react'
import {useRef, useState} from 'react'
import {LevelDropdown} from '@/features/words/components/LevelDropdown'

function setup() {
  const onSelect = vi.fn()
  const onNavigate = vi.fn()
  function Example() {
    const anchor = useRef<HTMLButtonElement>(null)
    const [open, setOpen] = useState(false)
    return <div onClick={onNavigate} style={{overflow: 'hidden'}}>
      <button ref={anchor} onClick={event => {event.stopPropagation(); setOpen(true)}}>Change level</button>
      {open && anchor.current && <LevelDropdown current={3} anchor={anchor.current}
        onSelect={level => {onSelect(level); setOpen(false)}} onClose={() => setOpen(false)} />}
    </div>
  }
  const result = render(<Example />)
  fireEvent.click(screen.getByRole('button', {name: 'Change level'}))
  return {...result, onSelect, onNavigate}
}

it('opens outside the clipping list, focuses the current level and supports keyboard selection', () => {
  const {container, onSelect, onNavigate} = setup()
  const menu = screen.getByRole('group', {name: 'Knowledge level'})
  expect(container.contains(menu)).toBe(false)
  expect(document.activeElement).toBe(screen.getByRole('button', {name: '3 Okay'}))
  fireEvent.keyDown(document.activeElement!, {key: 'ArrowDown'})
  expect(document.activeElement).toBe(screen.getByRole('button', {name: '4 Strong'}))
  fireEvent.click(document.activeElement!)
  expect(onSelect).toHaveBeenCalledWith(4)
  expect(onNavigate).not.toHaveBeenCalled()
  expect(screen.queryByRole('group')).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Change level'}))
})

it('Escape closes the picker without changing the word or triggering navigation', () => {
  const {onSelect, onNavigate} = setup()
  fireEvent.keyDown(document.activeElement!, {key: 'Escape'})
  expect(screen.queryByRole('group')).toBeNull()
  expect(onSelect).not.toHaveBeenCalled()
  expect(onNavigate).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Change level'}))
})
