import { useState, useEffect } from 'react'
import { canManageSettings } from '../domain'
import { useCurrentUser } from '../auth'
import { initialiseTheme, type AppTheme } from '../theme'
import './SettingsPage.css'

export function SettingsPage() {
  const currentUser = useCurrentUser()
  const hasSettingsAccess = canManageSettings(currentUser.role)
  const [theme, setTheme] = useState<AppTheme>(() => initialiseTheme())
  const [notifications, setNotifications] = useState(true)
  const [autoSync, setAutoSync] = useState(true)
  const [syncInterval, setSyncInterval] = useState(15)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('asg-theme', theme)
  }, [theme])

  if (!hasSettingsAccess) {
    return (
      <div className="settings-page">
        <header className="page__header">
          <div>
            <h1 className="page__title">Settings</h1>
          </div>
        </header>
        <section className="card">
          <div className="card__content">
            <p className="empty-state__description">You do not have permission to manage settings.</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="settings-page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Settings</h1>
          <p className="page__subtitle">Manage your preferences and account settings</p>
        </div>
      </header>

      <section className="settings-section card" aria-labelledby="appearance-heading">
        <div className="card__header">
          <h2 className="card__title" id="appearance-heading">Appearance</h2>
        </div>
        <div className="card__content">
          <div className="settings-grid">
            <div className="setting-item">
              <div className="setting-item__info">
                <h3 className="setting-item__title">Theme</h3>
                <p className="setting-item__description">Choose your preferred color theme</p>
              </div>
              <div className="setting-item__control">
                <div className="theme-selector" role="radiogroup" aria-label="Select theme">
                  {(['light', 'dark', 'high-contrast'] as const).map((t) => (
                    <label
                      key={t}
                      className={`theme-option ${theme === t ? 'theme-option--selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="theme"
                        value={t}
                        checked={theme === t}
                        onChange={() => setTheme(t)}
                        className="theme-option__input"
                      />
                      <div className="theme-option__preview" data-theme={t} aria-hidden="true">
                        <div className="theme-option__preview-header" />
                        <div className="theme-option__preview-content" />
                        <div className="theme-option__preview-footer" />
                      </div>
                      <span className="theme-option__label">
                        {t.charAt(0).toUpperCase() + t.slice(1).replace('-', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-item__info">
                <h3 className="setting-item__title">Map Style</h3>
                <p className="setting-item__description">Choose the base map style</p>
              </div>
              <div className="setting-item__control">
                <select className="form-input" style={{ maxWidth: '250px' }}>
                  <option value="streets">Streets</option>
                  <option value="satellite">Satellite</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="outdoor">Outdoor</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section card" aria-labelledby="notifications-heading">
        <div className="card__header">
          <h2 className="card__title" id="notifications-heading">Notifications & Sync</h2>
        </div>
        <div className="card__content">
          <div className="settings-grid">
            <div className="setting-item">
              <div className="setting-item__info">
                <h3 className="setting-item__title">Push Notifications</h3>
                <p className="setting-item__description">Receive notifications for new leads and sync status</p>
              </div>
              <div className="setting-item__control">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={notifications}
                    onChange={(e) => setNotifications(e.target.checked)}
                  />
                  <span className="toggle__slider" aria-hidden="true"></span>
                </label>
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-item__info">
                <h3 className="setting-item__title">Auto Sync</h3>
                <p className="setting-item__description">Automatically sync changes when online</p>
              </div>
              <div className="setting-item__control">
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={(e) => setAutoSync(e.target.checked)}
                  />
                  <span className="toggle__slider" aria-hidden="true"></span>
                </label>
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-item__info">
                <h3 className="setting-item__title">Sync Interval</h3>
                <p className="setting-item__description">How often to sync in minutes (when online)</p>
              </div>
              <div className="setting-item__control">
                <select
                  className="form-input"
                  style={{ maxWidth: '150px' }}
                  value={syncInterval}
                  onChange={(e) => setSyncInterval(Number(e.target.value))}
                  disabled={!autoSync}
                >
                  <option value={5}>5 minutes</option>
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section card" aria-labelledby="data-heading">
        <div className="card__header">
          <h2 className="card__title" id="data-heading">Data Management</h2>
        </div>
        <div className="card__content">
          <div className="settings-grid">
            <div className="setting-item">
              <div className="setting-item__info">
                <h3 className="setting-item__title">Export Data</h3>
                <p className="setting-item__description">Download all your pins and leads as CSV</p>
              </div>
              <div className="setting-item__control">
                <button className="btn btn--outline" type="button">
                  <svg className="icon btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-item__info">
                <h3 className="setting-item__title">Clear Local Data</h3>
                <p className="setting-item__description">Remove all locally stored pins and reset the app</p>
              </div>
              <div className="setting-item__control">
                <button className="btn btn--danger" type="button">
                  <svg className="icon btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                  Clear Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section card" aria-labelledby="account-heading">
        <div className="card__header">
          <h2 className="card__title" id="account-heading">Account</h2>
        </div>
        <div className="card__content">
          <div className="settings-grid">
            <div className="setting-item">
              <div className="setting-item__info">
                <h3 className="setting-item__title">Current User</h3>
                <p className="setting-item__description">Signed in as Field Rep</p>
              </div>
              <div className="setting-item__control">
                <button className="btn btn--secondary" type="button">View Profile</button>
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-item__info">
                <h3 className="setting-item__title">Sign Out</h3>
                <p className="setting-item__description">Sign out of your account</p>
              </div>
              <div className="setting-item__control">
                <button className="btn btn--outline" type="button">Sign Out</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="settings-section card" aria-labelledby="about-heading">
        <div className="card__header">
          <h2 className="card__title" id="about-heading">About</h2>
        </div>
        <div className="card__content">
          <div className="settings-grid">
            <div className="setting-item">
              <div className="setting-item__info">
                <h3 className="setting-item__title">Version</h3>
                <p className="setting-item__description">1.0.0 (Build 2026.08.26)</p>
              </div>
            </div>
            <div className="setting-item">
              <div className="setting-item__info">
                <h3 className="setting-item__title">License</h3>
                <p className="setting-item__description">ASG Proprietary</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
