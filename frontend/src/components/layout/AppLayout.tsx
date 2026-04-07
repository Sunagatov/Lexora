import {Outlet} from 'react-router-dom'

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <div>
            <h1 className="brand">Lexora</h1>
            <p className="subtitle">English vocabulary learning app</p>
          </div>
        </div>
      </header>

      <main className="container page-content">
        <Outlet />
      </main>
    </div>
  )
}