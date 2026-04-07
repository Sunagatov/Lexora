import {createBrowserRouter} from 'react-router-dom'

import {AppLayout} from '../components/layout/AppLayout'
import {LoginPage} from '../pages/LoginPage'
import {NotFoundPage} from '../pages/NotFoundPage'
import {StudyPage} from '../pages/StudyPage'

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
        element: <StudyPage />,
      },
    ],
  },
])