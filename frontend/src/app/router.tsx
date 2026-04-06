import {createBrowserRouter} from 'react-router-dom'

import {AppLayout} from '../components/layout/AppLayout'
import {NotFoundPage} from '../pages/NotFoundPage'
import {StudyPage} from '../pages/StudyPage'
import {TopicsPage} from '../pages/TopicsPage'
import {WordsPage} from '../pages/WordsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <StudyPage />,
      },
      {
        path: 'topics',
        element: <TopicsPage />,
      },
      {
        path: 'words',
        element: <WordsPage />,
      },
    ],
  },
])