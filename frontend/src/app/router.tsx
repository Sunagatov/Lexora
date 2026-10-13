import {createBrowserRouter} from 'react-router-dom'
import {AppLayout} from '@/app/layout/AppLayout'
import {NotFoundPage} from '@/app/layout/NotFoundPage'
import {LoginPage} from '@/features/auth/routes/LoginPage'
import {StudyPage} from '@/features/study/routes/StudyPage'
import {WordPage} from '@/features/words/routes/WordPage'
import {AllWordsPage} from '@/features/words/routes/AllWordsPage'
import {VocabularyPage} from '@/features/words/routes/VocabularyPage'
import {TrashPage} from '@/features/trash/routes/TrashPage'
import {StatsPage} from '@/features/stats/routes/StatsPage'
import {routes} from '@/app/routes'

export const router = createBrowserRouter([
  {path: routes.login, element: <LoginPage />},
  {
    path: routes.home,
    element: <AppLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {index: true,                element: <VocabularyPage />},
      {path: 'trash',              element: <TrashPage />},
      {path: 'stats',              element: <StatsPage />},
      {path: 'words',              element: <AllWordsPage />},
      {path: 'words/:wordId',      element: <WordPage />},
      {path: 'words/:wordId/edit', element: <WordPage />},
      {path: 'smart-review',       element: <StudyPage />},
      {path: 'topics/:topicSlug',  element: <StudyPage />},
    ],
  },
])
