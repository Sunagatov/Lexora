import {createBrowserRouter, Navigate} from 'react-router-dom'
import {AppLayout} from '@/app/layout/AppLayout'
import {NotFoundPage} from '@/app/layout/NotFoundPage'
import {LoginPage} from '@/features/auth/routes/LoginPage'
import {StudyPage} from '@/features/study/routes/StudyPage'
import {WordPage} from '@/features/words/routes/WordPage'
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
      {index: true,                element: <Navigate to={routes.smartReview} replace />},
      {path: 'trash',              element: <TrashPage />},
      {path: 'stats',              element: <StatsPage />},
      {path: 'words/:wordId',      element: <WordPage />},
      {path: 'words/:wordId/edit', element: <WordPage />},
      {path: 'smart-review',       element: <StudyPage />},
      {path: 'topics/:topicSlug',  element: <StudyPage />},
    ],
  },
])
