import {createBrowserRouter, Navigate} from 'react-router-dom'

import {AppLayout} from '../components/layout/AppLayout'
import {LoginPage} from '../pages/LoginPage'
import {NotFoundPage} from '../pages/NotFoundPage'
import {StudyPage} from '../pages/StudyPage'
import {WordPage} from '../pages/WordPage'
import {TrashPage} from '../pages/TrashPage'

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <Navigate to="/smart-review" replace />,
      },
      {
        path: 'trash',
        element: <TrashPage />,
      },
      {
        path: 'words/:wordId',
        element: <WordPage />,
      },
      {
        path: 'words/:wordId/edit',
        element: <WordPage />,
      },
      {
        path: 'smart-review',
        element: <StudyPage />,
      },
      {
        path: 'topics/:topicSlug',
        element: <StudyPage />,
      },
    ],
  },
])