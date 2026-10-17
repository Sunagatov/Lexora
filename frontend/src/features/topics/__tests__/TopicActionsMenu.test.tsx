import {fireEvent, render, screen} from '@testing-library/react'
import {TopicActionsMenu} from '@/features/topics/components/TopicActionsMenu'
import type {Topic} from '@/features/topics/types/topicTypes'

const topic = {id: 42, name: 'Personality & Character'} as Topic

function setup(isPinned = false) {
  const onPin = vi.fn(), onEdit = vi.fn(), onDelete = vi.fn()
  render(<TopicActionsMenu topic={topic} isPinned={isPinned} onPin={onPin} onEdit={onEdit} onDelete={onDelete} />)
  const trigger = screen.getByRole('button', {name: 'Actions for Personality & Character'})
  trigger.focus()
  fireEvent.click(trigger)
  return {trigger, onPin, onEdit, onDelete}
}

it('opens actions for the named topic and closes after pinning it', () => {
  const {onPin, onEdit, onDelete, trigger} = setup()
  expect(screen.getByRole('dialog', {name: 'Actions for Personality & Character'})).toBeTruthy()
  fireEvent.click(screen.getByRole('button', {name: 'Pin topic'}))
  expect(onPin).toHaveBeenCalledExactlyOnceWith(42)
  expect(onEdit).not.toHaveBeenCalled()
  expect(onDelete).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(trigger)
})

it.each(['Edit topic', 'Delete topic'])('forwards %s to the existing topic workflow', action => {
  const {onEdit, onDelete, onPin} = setup()
  fireEvent.click(screen.getByRole('button', {name: action}))
  expect(action === 'Edit topic' ? onEdit : onDelete).toHaveBeenCalledExactlyOnceWith(42)
  expect(onPin).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('offers Unpin and dismisses without changing a topic', () => {
  const {onPin, onEdit, onDelete, trigger} = setup(true)
  expect(screen.getByRole('button', {name: 'Unpin topic'})).toBeTruthy()
  fireEvent(screen.getByRole('dialog'), new Event('cancel', {bubbles: false, cancelable: true}))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(onPin).not.toHaveBeenCalled()
  expect(onEdit).not.toHaveBeenCalled()
  expect(onDelete).not.toHaveBeenCalled()
  expect(document.activeElement).toBe(trigger)
})
