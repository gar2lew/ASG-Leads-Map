import type { ReactNode } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import './Layout.css'

interface LayoutProps {
  children?: ReactNode
}

export function Layout({ children }: LayoutProps) {
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
              <li>
                <NavLink
                  to="/dashboard"
                  className={({ isActive }) =>
                    `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`}
                >
                  Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/settings"
                  className={({ isActive }) =>
                    `header__nav-link ${isActive ? 'header__nav-link--active' : ''}`}
                >
                  Settings
                </NavLink>
              </li>
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
              <button className="btn btn--ghost btn--sm header__user-button" aria-expanded="false" aria-haspopup="true" type="button">
                <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="header__user-name">Rep User</span>
                <svg className="icon icon--chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
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
    </div>
  )
}