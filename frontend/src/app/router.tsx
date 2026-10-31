import {createBrowserRouter, Navigate} from 'react-router-dom'
import {AppLayout} from '@/app/layout/AppLayout'
import {NotFoundPage} from '@/app/layout/NotFoundPage'
import {LoginPage} from '@/features/auth/routes/LoginPage'
import {StudyPage} from '@/features/study/routes/StudyPage'
import {WordPage} from '@/features/words/routes/WordPage'
import {AllWordsPage} from '@/features/words/routes/AllWordsPage'
import {VocabularyPage} from '@/features/words/routes/VocabularyPage'
import {routes} from '@/app/routes'
import {AccountPage} from '@/features/preferences/AccountPage'

export const router = createBrowserRouter([
  {path: routes.login, element: <LoginPage />},
  {
    path: routes.home,
    element: <AppLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {index: true,                element: <VocabularyPage />},
      {path: 'trash',              element: <Navigate to="/account/trash" replace />},
      {path: 'stats',              element: <Navigate to="/account/statistics" replace />},
      {path: 'account',            element: <AccountPage />},
      {path: 'account/:section',   element: <AccountPage />},
      {path: 'favorites',          element: <VocabularyPage favoritesOnly />},
      {path: 'words',              element: <AllWordsPage />},
      {path: 'words/:wordId',      element: <WordPage />},
      {path: 'words/:wordId/edit', element: <WordPage />},
      {path: 'smart-review',       element: <StudyPage />},
      {path: 'topics/:topicSlug',  element: <StudyPage />},
    ],
  },
])
