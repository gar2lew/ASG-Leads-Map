import type { ReactNode } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useCurrentUser, getAuthService } from '../auth'
import { canViewReports, canManageSettings, canManageUsers, roleLabel } from '../domain'
import './Layout.css'

interface LayoutProps {
  children?: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const currentUser = useCurrentUser()
  const showReports = canViewReports(currentUser.role)
  const showSettings = canManageSettings(currentUser.role)
  const showAdminUsers = canManageUsers(currentUser.role)

  const handleSignOut = async () => {
    try {
      await getAuthService().signOut()
    } catch (error) {
      console.error('Sign out failed:', error)
    }
  }

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="app__header" role="banner">
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
          <nav className="header__nav" role="navigation" aria-label="Main navigation">
            <ul className="header__nav-list">
              <li>
                <NavLink
                  to="/map"
                  className={({ isActive }) =>
                    `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`}
                >
                  Map
                </NavLink>
              </li>
              {showReports && (
                <li>
                  <NavLink
                    to="/dashboard"
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
                    className={({ isActive }) =>
                      `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`}
                  >
                    Admin Users
                  </NavLink>
                </li>
              )}
              {showSettings && (
                <li>
                  <NavLink
                    to="/settings"
                    className={({ isActive }) =>
                      `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`}
                  >
                    Settings
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>
          <div className="header__actions">
            <button
              className="btn btn--ghost btn--sm header__theme-toggle"
              aria-label="Toggle theme"
              type="button"
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
      <nav className="app__mobile-nav" aria-label="Field navigation">
        <NavLink
          to="/map"
          className={({ isActive }) => `app__mobile-nav-link ${isActive ? 'app__mobile-nav-link--active' : ''}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <span>Map</span>
        </NavLink>
        {showReports && (
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `app__mobile-nav-link ${isActive ? 'app__mobile-nav-link--active' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />
            </svg>
            <span>Dashboard</span>
          </NavLink>
        )}
        {showSettings && (
          <NavLink
            to="/settings"
            className={({ isActive }) => `app__mobile-nav-link ${isActive ? 'app__mobile-nav-link--active' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
            <span>Settings</span>
          </NavLink>
        )}
      </nav>
    </div>
  )
}
