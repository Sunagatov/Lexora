import {useLayoutEffect, useRef, useState} from 'react'
import {createPortal} from 'react-dom'
import {Link} from 'react-router-dom'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {routes} from '@/app/routes'
import {queryKeys} from '@/app/queryKeys'
import {usePublicConfig} from '@/shared/config/usePublicConfig'
import {deleteWord} from '@/features/words/api/wordsApi'
import {invalidateWordDependencies, removeWordFromLists} from '@/features/words/model/wordCache'
import {useWordListNavigation, type WordListContext} from '@/features/words/hooks/useWordListNavigation'
import type {Word} from '@/features/words/types/wordTypes'

type Props = {
  word: Word; wordList?: WordListContext; fromTopicSlug?: string; disabled?: boolean
}

export function WordActionsMenu(props: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return <>
    <button ref={triggerRef} type="button" className="word-actions-trigger" aria-label={`Actions for ${props.word.term}`}
      aria-haspopup="dialog" aria-expanded={open} disabled={props.disabled}
      onClick={event => { event.stopPropagation(); setOpen(true) }}>
      <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><circle cx="9" cy="3" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="9" cy="15" r="1.5"/></svg>
    </button>
    {open && <WordActionsDialog {...props} anchor={triggerRef.current} onClose={() => setOpen(false)} />}
  </>
}

function WordActionsDialog({word, wordList, fromTopicSlug, anchor, onClose}: Props & {anchor: HTMLButtonElement | null; onClose: () => void}) {
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const queryClient = useQueryClient()
  const config = usePublicConfig()
  const navigation = useWordListNavigation(fromTopicSlug, wordList)
  const deletion = useMutation({
    mutationFn: () => deleteWord(word.id),
    onSuccess: () => {
      onClose()
      removeWordFromLists(queryClient, word.id)
      invalidateWordDependencies(queryClient, [queryKeys.trashWords])
    },
  })

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { dialog?.close(); if (anchor?.isConnected) anchor.focus({preventScroll: true}) }
  }, [anchor])

  function close() { if (!deletion.isPending) onClose() }

  return createPortal(<dialog ref={dialogRef} className="word-actions-dialog" aria-label={`Actions for ${word.term}`}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); close() }}
      onClick={event => { event.stopPropagation(); if (event.target === event.currentTarget) close() }}>
      <div className="word-actions-content">
        <div className="word-actions-heading">
          <h2>{confirming ? 'Move to Trash?' : word.term}</h2>
          <button type="button" className="word-actions-close" aria-label="Close word actions"
            disabled={deletion.isPending} onClick={close}>×</button>
        </div>
        {confirming ? <>
          <p>“{word.term}” will be moved to Trash and permanently deleted after {config.data?.trash_retention_days ?? 30} days.</p>
          {deletion.isError && <p role="alert">Could not move this word to Trash. Please try again.</p>}
          <button type="button" className="word-action-danger" disabled={deletion.isPending} onClick={() => deletion.mutate()}>{deletion.isPending ? 'Moving…' : 'Move to Trash'}</button>
          <button type="button" disabled={deletion.isPending} onClick={() => setConfirming(false)}>Cancel</button>
        </> : <>
          <Link to={routes.editWord(word.id)} state={navigation.state} onClick={event => navigation.openWord(event, word.id, true)}>Edit word & topics</Link>
          <button type="button" onClick={async () => {
            try { await navigator.clipboard.writeText(word.term); setMessage('Word copied') }
            catch { setMessage('Could not copy. Select and copy the word manually.') }
          }}>Copy word</button>
          <button type="button" className="word-action-danger" onClick={() => setConfirming(true)}>Move to Trash</button>
          {message && <p role="status">{message}</p>}
        </>}
      </div>
    </dialog>, document.body)
}
