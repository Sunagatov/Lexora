import {startBrowserTelemetry} from '@/shared/browserTelemetry'
import React from 'react'
import ReactDOM from 'react-dom/client'
import {RouterProvider} from 'react-router-dom'

import {Providers} from '@/app/providers'
import {router} from '@/app/router'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </React.StrictMode>,
)

void startBrowserTelemetry(import.meta.env.VITE_FARO_URL, 'lexora-frontend')
