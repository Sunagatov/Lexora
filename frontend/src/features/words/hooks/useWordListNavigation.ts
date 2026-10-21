import {useLayoutEffect} from 'react'
import type {MouseEvent} from 'react'
import {useLocation, useNavigate} from 'react-router-dom'
import {routes} from '@/app/routes'
import type {WordListParams} from '@/features/words/api/wordsApi'

export type WordListContext = {
  ids: number[]
  offset: number
  total: number
  query?: WordListParams
}

export type WordLocationState = {
  fromTopicSlug?: string
  returnTo?: {pathname: string; search: string; scrollTop?: number}
  wordList?: WordListContext
}

function listScrollElement() {
  return document.querySelector('.word-collection-scroll, .all-words-page') ?? document.scrollingElement
}

export function useWordListNavigation(fromTopicSlug?: string, wordList?: WordListContext) {
  const location = useLocation()
  const navigate = useNavigate()
  const returnTo = {pathname: location.pathname, search: location.search}
  const state: WordLocationState = {
    fromTopicSlug,
    returnTo,
    wordList,
  }

  function openWord(event: MouseEvent<HTMLElement>, wordId: number, editing = false) {
    // Preserve normal open-in-new-tab and modified-link behavior.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(editing ? routes.editWord(wordId) : routes.word(wordId), {
      state: {...state, returnTo: {...returnTo, scrollTop: listScrollElement()?.scrollTop ?? 0}},
    })
  }

  return {state, openWord}
}

export function useWordListScrollRestore(isLoading: boolean) {
  const location = useLocation()
  const scrollTop = (location.state as {wordListScrollTop?: number} | null)?.wordListScrollTop
  useLayoutEffect(() => {
    if (isLoading || scrollTop === undefined) return
    const element = listScrollElement()
    if (element) element.scrollTop = scrollTop
  }, [isLoading, location.key, scrollTop])
}
