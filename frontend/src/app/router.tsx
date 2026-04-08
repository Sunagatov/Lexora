import {createBrowserRouter, Navigate} from 'react-router-dom'

import {AppLayout} from '../components/layout/AppLayout'
import {LoginPage} from '../pages/LoginPage'
import {NotFoundPage} from '../pages/NotFoundPage'
import {StudyPage} from '../pages/StudyPage'
import {WordPage} from '../pages/WordPage'

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
        element: <Navigate to="/study/smart-review" replace />,
      },
      {
        path: 'words/:wordId',
        element: <WordPage />,
      },
      {
        path: 'study',
        children: [
          { index: true, element: <Navigate to="smart-review" replace /> },
          { path: 'smart-review', element: <StudyPage /> },
          { path: 'topics/:topicId', element: <StudyPage /> },
        ],
      },
    ],
  },
])