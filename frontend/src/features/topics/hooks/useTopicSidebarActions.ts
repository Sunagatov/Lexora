import {useRef, useState} from 'react'
import type {ChangeEvent} from 'react'
import {useNavigate} from 'react-router-dom'
import {useMutation, useQueryClient} from '@tanstack/react-query'
import {ApiError} from '@/shared/api/apiError'
import {queryKeys} from '@/app/queryKeys'
import {routes} from '@/app/routes'
import type {Topic} from '@/features/topics/types/topicTypes'
import {createTopic, deleteTopic, updateTopic, type TopicUpdatePayload} from '@/features/topics/api/topicsApi'
import {
  appendTopicToLists,
  invalidateTopicDependencies,
  invalidateTopicTrashDependencies,
  replaceTopicInLists,
} from '@/features/topics/model/topicCache'
import {
  formatWorkbookImportSuccessMessage,
  getWorkbookActionErrorMessage,
} from '@/features/topics/model/workbookFeedback'
import {exportWordsWorkbook, importWordsWorkbook} from '@/features/words/api/wordsApi'
import {redirectIfUnauthorized} from '@/features/auth/lib/redirectIfUnauthorized'

type Params = {
  topics: Topic[]
  selectedTopic: Topic | null
  canUseSelectedTopicAsParent: boolean
}

export function useTopicSidebarActions({topics, selectedTopic, canUseSelectedTopicAsParent}: Params) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const importInputRef = useRef<HTMLInputElement>(null)

  const [deleteTopicId, setDeleteTopicId] = useState<number | null>(null)
  const [deleteTopicError, setDeleteTopicError] = useState<string | null>(null)
  const [editTopicId, setEditTopicId] = useState<number | null>(null)
  const [editTopicError, setEditTopicError] = useState<string | null>(null)
  const [newTopicName, setNewTopicName] = useState('')
  const [newTopicParentId, setNewTopicParentId] = useState<number | ''>('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [topicError, setTopicError] = useState<string | null>(null)
  const [workbookBusy, setWorkbookBusy] = useState(false)

  const editingTopic = topics.find((topic) => topic.id === editTopicId) ?? null

  const createTopicMutation = useMutation({
    mutationFn: () => createTopic(newTopicName.trim(), newTopicParentId === '' ? null : newTopicParentId),
    onSuccess: (created) => {
      appendTopicToLists(queryClient, created)
      void queryClient.invalidateQueries({queryKey: queryKeys.stats})
      setNewTopicName('')
      setNewTopicParentId('')
      setAddingTopic(false)
      setTopicError(null)
      navigate(routes.topic(created.slug))
    },
    onError: (error: Error) => {
      setTopicError(
        error instanceof ApiError && (error.status === 400 || error.status === 409)
          ? error.message
          : 'Could not create topic.',
      )
    },
  })

  const deleteTopicMutation = useMutation({
    mutationFn: (id: number) => deleteTopic(id, false),
    onSuccess: async () => {
      await invalidateTopicTrashDependencies(queryClient)
      setDeleteTopicId(null)
      setDeleteTopicError(null)
    },
    onError: (error: Error) => {
      setDeleteTopicError(error instanceof ApiError && error.message ? error.message : 'Could not delete topic.')
    },
  })

  const updateTopicMutation = useMutation({
    mutationFn: ({id, payload}: {id: number; payload: TopicUpdatePayload}) => updateTopic(id, payload),
    onSuccess: async (updated) => {
      replaceTopicInLists(queryClient, updated)
      await invalidateTopicDependencies(queryClient)
      setEditTopicId(null)
      setEditTopicError(null)
      navigate(routes.topic(updated.slug), {replace: true})
    },
    onError: (error: Error) => {
      setEditTopicError(
        error instanceof ApiError && error.status === 409
          ? error.message
          : error.message || 'Could not save topic.',
      )
    },
  })

  async function handleExportWorkbook() {
    try {
      setWorkbookBusy(true)
      await exportWordsWorkbook()
    } catch (error) {
      redirectIfUnauthorized(error)
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return
      window.alert(getWorkbookActionErrorMessage(error, 'Failed to export workbook.'))
    } finally {
      setWorkbookBusy(false)
    }
  }

  async function handleImportWorkbookChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      setWorkbookBusy(true)
      const result = await importWordsWorkbook(file)
      await invalidateTopicDependencies(queryClient)
      window.alert(formatWorkbookImportSuccessMessage(result))
    } catch (error) {
      redirectIfUnauthorized(error)
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) return
      window.alert(getWorkbookActionErrorMessage(error, 'Failed to import workbook.'))
    } finally {
      setWorkbookBusy(false)
    }
  }

  function startAddTopic() {
    setNewTopicParentId(selectedTopic && canUseSelectedTopicAsParent ? selectedTopic.id : '')
    setAddingTopic(true)
  }

  function changeNewTopicName(value: string) {
    setNewTopicName(value)
    setTopicError(null)
  }

  function openDeleteTopic(id: number) {
    setDeleteTopicId(id)
    setDeleteTopicError(null)
  }

  function closeDeleteTopic() {
    setDeleteTopicId(null)
    setDeleteTopicError(null)
  }

  function openEditTopic(id: number) {
    setEditTopicId(id)
    setEditTopicError(null)
  }

  function closeEditTopic() {
    setEditTopicId(null)
    setEditTopicError(null)
  }

  function cancelAddTopic() {
    setAddingTopic(false)
    setNewTopicName('')
    setNewTopicParentId('')
    setTopicError(null)
  }

  return {
    importInputRef,
    addingTopic,
    setAddingTopic,
    newTopicName,
    changeNewTopicName,
    newTopicParentId,
    setNewTopicParentId,
    topicError,
    setTopicError,
    workbookBusy,
    deleteTopicId,
    openDeleteTopic,
    closeDeleteTopic,
    deleteTopicError,
    editTopicId,
    openEditTopic,
    closeEditTopic,
    editTopicError,
    editingTopic,
    createTopicMutation,
    deleteTopicMutation,
    updateTopicMutation,
    handleExportWorkbook,
    handleImportWorkbookChange,
    startAddTopic,
    cancelAddTopic,
  }
}
