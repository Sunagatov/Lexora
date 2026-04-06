import {NavLink, Outlet} from 'react-router-dom'

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="container topbar-inner">
          <div>
            <h1 className="brand">Lexora</h1>
            <p className="subtitle">English vocabulary learning app</p>
          </div>

          <nav className="nav">
            <NavLink
              to="/"
              end
              className={({isActive}) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            >
              Study
            </NavLink>

            <NavLink
              to="/topics"
              className={({isActive}) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            >
              Topics
            </NavLink>

            <NavLink
              to="/words"
              className={({isActive}) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
            >
              Words
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="container page-content">
        <Outlet />
      </main>
    </div>
  )
}