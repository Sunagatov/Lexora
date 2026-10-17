import {act, renderHook, waitFor} from '@testing-library/react'
import {QueryClient, QueryClientProvider} from '@tanstack/react-query'
import type {ReactNode} from 'react'
import {useWordUpdate} from '@/features/words/hooks/useWordUpdate'
import * as api from '@/features/words/api/wordsApi'
import {queryKeys} from '@/app/queryKeys'
import type {Word} from '@/features/words/types/wordTypes'
import type {StudyQueue} from '@/features/smart-review/types/studyQueueTypes'
import type {WordListResponse} from '@/features/words/api/wordsApi'
import {DEFAULT_WORD_PROGRESS_SOURCE} from '@/features/words/model/wordDomain'

vi.mock('@/features/words/api/wordsApi')
const onMutate = vi.fn()

describe('useWordUpdate rollback', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {queries: {retry: false}, mutations: {retry: false}},
    })
    vi.clearAllMocks()
    onMutate.mockReset()
  })

  function wrapper({children}: {children: ReactNode}) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }

  function makeWord(id: number, term: string, knowledge_level: Word['knowledge_level']): Word {
    return {
      id,
      topic_ids: [1],
      term,
      language: 'en',
      definition: null,
      pronunciation_ipa: null,
      pronunciation_audio_url: null,
      image_url: null,
      cefr_level: null,
      register: null,
      frequency_rank: null,
      verb_form: null,
      translation_entries: [term],
      part_of_speech: 'verb',
      knowledge_level,
      countability: null,
      pattern: null,
      example_entries: [],
      example_count: 0,
      example_target_count: 3,
      example_status: 'missing',
      needs_example_enrichment: true,
      synonym_entries: [],
      antonym_entries: [],
      collocation_entries: [],
      confusable_entries: [],
      notes: null,
      is_active: true,
      deleted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  it('restores exact ["words"] key on failed mutation', async () => {
    const prevData: Word[] = [makeWord(1, 'run', 1)]

    queryClient.setQueryData(queryKeys.words, prevData)

    vi.mocked(api.updateWordKnowledgeLevel).mockRejectedValueOnce(new Error('Network error'))

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const {result} = renderHook(() => useWordUpdate(onMutate), {wrapper})

    await waitFor(() => {
      result.current.updateLevel(1, 3)
    })

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.words)).toEqual(prevData)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topicSidebar})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
  })

  it('restores topic-scoped ["words", topicId] key on failed mutation', async () => {
    const topicId = 42
    const prevData: Word[] = [makeWord(1, 'run', 1)]

    queryClient.setQueryData([...queryKeys.words, topicId], prevData)

    vi.mocked(api.updateWordKnowledgeLevel).mockRejectedValueOnce(new Error('Network error'))

    const {result} = renderHook(() => useWordUpdate(onMutate), {wrapper})

    await waitFor(() => {
      result.current.updateLevel(1, 3)
    })

    await waitFor(() => {
      expect(queryClient.getQueryData([...queryKeys.words, topicId])).toEqual(prevData)
    })
  })

  it('restores all ["words", ...] query family on failed mutation', async () => {
    const rootData: Word[] = [makeWord(1, 'run', 1)]
    const topic1Data: Word[] = [makeWord(2, 'walk', 3)]
    const topic2Data: Word[] = [makeWord(3, 'jump', 1)]

    queryClient.setQueryData(queryKeys.words, rootData)
    queryClient.setQueryData([...queryKeys.words, 1], topic1Data)
    queryClient.setQueryData([...queryKeys.words, 2], topic2Data)

    vi.mocked(api.updateWordKnowledgeLevel).mockRejectedValueOnce(new Error('Network error'))

    const {result} = renderHook(() => useWordUpdate(onMutate), {wrapper})

    await waitFor(() => {
      result.current.updateLevel(1, 3)
    })

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.words)).toEqual(rootData)
      expect(queryClient.getQueryData([...queryKeys.words, 1])).toEqual(topic1Data)
      expect(queryClient.getQueryData([...queryKeys.words, 2])).toEqual(topic2Data)
    })
  })

  it('invalidates sidebar and stats after a successful level update', async () => {
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    vi.mocked(api.updateWordKnowledgeLevel).mockResolvedValueOnce(makeWord(1, 'run', 3))

    const {result} = renderHook(() => useWordUpdate(onMutate), {wrapper})

    result.current.updateLevel(1, 3)

    await waitFor(() => {
      expect(api.updateWordKnowledgeLevel).toHaveBeenCalledWith(1, 3, DEFAULT_WORD_PROGRESS_SOURCE)
    })

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.topicSidebar})
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: queryKeys.stats})
  })

  it('restores the Daily Word Mix level when saving fails', async () => {
    const word = makeWord(1, 'run', 1)
    const queue: StudyQueue = {
      id: 10, generated_at: word.created_at, expires_at: word.created_at,
      is_active: true, total_count: 1, completed_count: 0,
      items: [{id: 101, word_id: 1, position: 0, is_completed: false, completed_at: null, word}],
    }
    queryClient.setQueryData(queryKeys.smartReview, queue)
    let rejectSave!: (error: Error) => void
    vi.mocked(api.updateWordKnowledgeLevel).mockImplementationOnce(
      () => new Promise((_resolve, reject) => { rejectSave = reject }),
    )
    const {result} = renderHook(() => useWordUpdate(onMutate), {wrapper})
    let save!: Promise<Word>
    act(() => { save = result.current.updateLevelAsync(1, 3) })
    const failedSave = save.catch(() => undefined)
    await waitFor(() => {
      expect(queryClient.getQueryData<StudyQueue>(queryKeys.smartReview)?.items[0].word.knowledge_level).toBe(3)
    })
    await act(async () => { rejectSave(new Error('Network error')); await failedSave })
    expect(queryClient.getQueryData(queryKeys.smartReview)).toEqual(queue)
  })

  it('updates a cached word detail after saving the level', async () => {
    const word = makeWord(1, 'run', 1)
    const updated = {...word, knowledge_level: 3 as const}
    queryClient.setQueryData(queryKeys.word(1), word)
    vi.mocked(api.updateWordKnowledgeLevel).mockResolvedValueOnce(updated)
    const {result} = renderHook(() => useWordUpdate(onMutate), {wrapper})
    await act(async () => { await result.current.updateLevelAsync(1, 3) })
    expect(queryClient.getQueryData(queryKeys.word(1))).toEqual(updated)
  })

  it('restores a failed optimistic level in a paginated page without rolling back other saved words', async () => {
    const first = makeWord(1, 'run', 1)
    const second = makeWord(2, 'walk', 1)
    const key = [...queryKeys.wordList, {level: 1, page: 1}]
    const page: WordListResponse = {words: [first, second], total: 2, page: 1, page_size: 50, total_pages: 1}
    queryClient.setQueryData(key, page)
    let rejectSave!: (error: Error) => void
    vi.mocked(api.updateWordKnowledgeLevel).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject }))
    const {result} = renderHook(() => useWordUpdate(onMutate), {wrapper})
    let save!: Promise<Word>
    act(() => { save = result.current.updateLevelAsync(1, 4) })
    const failed = save.catch(() => undefined)
    await waitFor(() => expect(queryClient.getQueryData<WordListResponse>(key)?.words[0].knowledge_level).toBe(4))
    queryClient.setQueryData<WordListResponse>(key, current => ({...current!, words: [{...current!.words[0], notes: 'Edited while saving'}, {...second, knowledge_level: 3}]}))
    await act(async () => { rejectSave(new Error('Save failed')); await failed })
    expect(queryClient.getQueryData<WordListResponse>(key)?.words.map(word => [word.id, word.knowledge_level])).toEqual([[1, 1], [2, 3]])
    expect(queryClient.getQueryData<WordListResponse>(key)?.words[0].notes).toBe('Edited while saving')
  })

  it('rolls back only the failed word in topic lists and preserves concurrent edits and deletions', async () => {
    const first = makeWord(1, 'run', 1)
    const second = makeWord(2, 'walk', 1)
    const third = makeWord(3, 'jump', 1)
    const key = queryKeys.topicWords(1)
    queryClient.setQueryData(key, [first, second, third])
    let rejectSave!: (error: Error) => void
    vi.mocked(api.updateWordKnowledgeLevel).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectSave = reject }))
    const {result} = renderHook(() => useWordUpdate(onMutate), {wrapper})
    let save!: Promise<Word>
    act(() => { save = result.current.updateLevelAsync(1, 4) })
    const failed = save.catch(() => undefined)
    await waitFor(() => expect(queryClient.getQueryData<Word[]>(key)?.[0].knowledge_level).toBe(4))
    queryClient.setQueryData<Word[]>(key, current => [
      {...current![0], notes: 'Edited while saving'}, {...second, knowledge_level: 3},
    ])
    await act(async () => { rejectSave(new Error('Save failed')); await failed })
    expect(queryClient.getQueryData<Word[]>(key)).toEqual([
      {...first, notes: 'Edited while saving'}, {...second, knowledge_level: 3},
    ])
  })
})
