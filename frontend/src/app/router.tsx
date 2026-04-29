import {createBrowserRouter, Navigate} from 'react-router-dom'
import {AppLayout} from '../layout/AppLayout'
import {NotFoundPage} from '../layout/NotFoundPage'
import {LoginPage} from '../features/auth/LoginPage'
import {StudyPage} from '../features/study/StudyPage'
import {WordPage} from '../features/words/WordPage'
import {TrashPage} from '../features/trash/TrashPage'
import {StatsPage} from '../features/stats/StatsPage'
import {routes} from './routes'

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
