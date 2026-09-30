import { useState, type ReactNode } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useCurrentUser, getAuthService } from '../auth'
import { canViewReports, canManageSettings, canManageUsers, roleLabel, canManageTerritories } from '../domain'
import { DEFAULT_WORKSPACE_STORAGE_KEY, getAvailableWorkspaces, type WorkspaceId } from '../domain/workspaces'
import './Layout.css'
import { applyTheme, initialiseTheme, nextTheme, type AppTheme } from '../theme'

interface LayoutProps {
  children?: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const currentUser = useCurrentUser()
  const location = useLocation()
  const [theme, setTheme] = useState<AppTheme>(() => initialiseTheme())
  const [adminMenuOpen, setAdminMenuOpen] = useState(false)
  const dailyWorkspaces = getAvailableWorkspaces(currentUser).filter((workspace) => workspace.id !== 'import')
  const canNavigate = dailyWorkspaces.length > 0
  const showReports = canNavigate && canViewReports(currentUser.role)
  const showSettings = canNavigate && canManageSettings(currentUser.role)
  const showAdminUsers = canNavigate && canManageUsers(currentUser.role)
  const showAdminTerritories = canNavigate && canManageTerritories(currentUser.role)
  const showAdministration = showReports || showSettings || showAdminUsers || showAdminTerritories
  const activeWorkspace = dailyWorkspaces.find((workspace) => location.pathname === workspace.landingRoute)
  const workspaceLabel = (id: WorkspaceId) => id === 'map' ? 'Field Workspace' : 'Call Centre'

  const rememberWorkspace = (workspaceId: WorkspaceId) => {
    try {
      localStorage.setItem(DEFAULT_WORKSPACE_STORAGE_KEY, workspaceId)
    } catch {
      // Navigation still works when storage is unavailable.
    }
  }

  const handleSignOut = async () => {
    try {
      await getAuthService().signOut()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  const handleThemeToggle = () => {
    const updatedTheme = nextTheme(theme)
    setTheme(updatedTheme)
    applyTheme(updatedTheme)
    try {
      localStorage.setItem('asg-theme', updatedTheme)
    } catch {
      // Theme stays applied for this session when storage is disabled.
    }
  }

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="app__header layout__header" role="banner">
        <div className="header__container container">
          <NavLink to="/map" className="header__logo" aria-label="ASG Leads Map Pins - Home">
            <img
              src="/logo.png"
              alt=""
              className="header__logo-image"
              width="48"
              height="48"
              aria-hidden="true"
            />
            <span className="header__logo-text">ASG Leads Map</span>
          </NavLink>
          <div className="header__workspace-group">
          <span className="header__current-workspace" aria-label="Current workspace">
            {activeWorkspace ? workspaceLabel(activeWorkspace.id) : 'Operations'}
          </span>
          <nav className="header__nav header__workspace-nav" aria-label="Workspaces">
            <ul className="header__nav-list">
              {dailyWorkspaces.map((workspace) => (
                <li key={workspace.id}>
                  <NavLink
                    to={workspace.landingRoute}
                    onClick={() => rememberWorkspace(workspace.id)}
                    className={({ isActive }) => `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`}
                  >
                    {workspaceLabel(workspace.id)}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          </div>
          {showAdministration && (
          <div className="header__admin-menu" onKeyDown={(event) => {
            if (event.key === 'Escape') setAdminMenuOpen(false)
          }}>
          <button
            className="header__admin-trigger"
            type="button"
            aria-label="Administration"
            aria-expanded={adminMenuOpen}
            aria-controls="administration-menu"
            onClick={() => setAdminMenuOpen((open) => !open)}
          >
            Administration <span aria-hidden="true">⌄</span>
          </button>
          {adminMenuOpen && <nav id="administration-menu" className="header__admin-nav" aria-label="Administration">
            <ul className="header__nav-list">
              {showReports && (
                <li>
                  <NavLink
                    to="/dashboard"
                    onClick={() => setAdminMenuOpen(false)}
                    className={({ isActive }) =>
                      `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`}
                  >
                    Dashboard
                  </NavLink>
                </li>
              )}
              {showAdminUsers && (
                <li>
                  <NavLink
                    to="/admin/users"
                    onClick={() => setAdminMenuOpen(false)}
                    className={({ isActive }) =>
                      `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`}
                  >
                    Admin Users
                  </NavLink>
                </li>
              )}
              {showAdminUsers && (
                              <li>
                                <NavLink
                                  to="/admin/import"
                                  onClick={() => setAdminMenuOpen(false)}
                                  className={({ isActive }) =>
                                    `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`}
                                >
                                  Import Leads
                                </NavLink>
                              </li>
                            )}
                            {showAdminTerritories && (
                              <li>
                                <NavLink
                                  to="/admin/territories"
                                  onClick={() => setAdminMenuOpen(false)}
                                  className={({ isActive }) =>
                                    `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`}
                                >
                                  Territories
                                </NavLink>
                              </li>
                            )}
              {showSettings && (
                <li>
                  <NavLink
                    to="/settings"
                    onClick={() => setAdminMenuOpen(false)}
                    className={({ isActive }) =>
                      `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`}
                  >
                    Settings
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>}
          </div>
          )}
          <div className="header__actions">
            <button
              className="btn btn--ghost btn--sm header__theme-toggle"
              aria-label="Toggle theme"
              type="button"
              onClick={handleThemeToggle}
              title={`Switch to ${nextTheme(theme).replace('-', ' ')} theme`}
              aria-pressed={theme !== 'light'}
            >
              <svg className="icon icon--sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
              <svg className="icon icon--moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            </button>
            <div className="header__user-menu">
              <div className="header__user-info">
                <span className="header__user-name">{currentUser.name}</span>
                <span className="header__user-role">{roleLabel(currentUser.role)}</span>
              </div>
              <button
                className="btn btn--ghost btn--sm header__sign-out"
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>
      <main id="main-content" className="app__main" role="main">
        <div className="app__content container">
          {children || <Outlet />}
        </div>
      </main>
      <footer className="app__footer" role="contentinfo">
        <div className="container">
          <p className="app__footer-text">ASG Leads Map Pins &copy; 2026</p>
        </div>
      </footer>
      <nav className="app__mobile-nav" aria-label="Workspace navigation">
        {dailyWorkspaces.map((workspace) => (
          <NavLink
            key={workspace.id}
            to={workspace.landingRoute}
            onClick={() => rememberWorkspace(workspace.id)}
            className={({ isActive }) => `app__mobile-nav-link ${isActive ? 'app__mobile-nav-link--active' : ''}`}
          >
            <span>{workspaceLabel(workspace.id)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
