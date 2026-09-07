import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth, getAuthService, isDevAuthActive, isAuthError } from '../auth'
import { AuthLoadingScreen } from '../components/RouteGuards'
import './LoginPage.css'

interface LoginLocationState {
  from?: string
}

export function LoginPage() {
  const { status, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LoginLocationState | null)?.from ?? '/map'
  const devAuth = isDevAuthActive()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginMode, setLoginMode] = useState<'rep' | 'admin'>('admin')
  const [repName, setRepName] = useState('')
  const [pin, setPin] = useState('')
  const [repNames, setRepNames] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (devAuth) return
    void fetch('/api/auth/rep-names').then((response) => response.ok ? response.json() : { reps: [] }).then((body: { reps?: Array<{ displayName?: string }> }) => {
      setRepNames((body.reps ?? []).flatMap((rep) => rep.displayName ? [rep.displayName] : []))
    }).catch(() => undefined)
  }, [devAuth])

  if (status === 'loading') {
    return <AuthLoadingScreen />
  }

  if (status === 'signed-in' && user) {
    return <Navigate to={from} replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      if (loginMode === 'rep') {
        await getAuthService().signInWithPin(repName, pin)
      } else {
        await getAuthService().signIn(email, password)
      }
      navigate(from, { replace: true })
    } catch (caught) {
      if (isAuthError(caught)) {
        setError(caught.message)
      } else {
        setError(caught instanceof Error ? caught.message : 'Unable to sign in. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-page login-experience">
      <aside className="login-page__brand" aria-label="ASG Leads Map">
        <span className="login-page__brand-mark">ASG</span>
        <p className="login-page__brand-overline">Amplify Solutions Group</p>
        <h2>Field intelligence,<br />beautifully organised.</h2>
        <p>Capture every visit, protect every lead, and keep your territory moving.</p>
      </aside>
      <div className="login-page__card">
        <header className="login-page__header">
          <img src="/logo.png" alt="" className="login-page__logo" width="56" height="56" />
          <h1 className="login-page__title">ASG Leads Map</h1>
          <p className="login-page__subtitle">Sign in to continue</p>
        </header>

        <div className="login-page__mode" role="tablist" aria-label="Sign-in type">
          <button type="button" className={loginMode === 'rep' ? 'is-active' : ''} onClick={() => setLoginMode('rep')}>Rep sign in</button>
          <button type="button" className={loginMode === 'admin' ? 'is-active' : ''} onClick={() => setLoginMode('admin')}>Administrator</button>
        </div>

        {error && (
          <div className="login-page__error" role="alert">
            {error}
          </div>
        )}

        <form className="login-page__form" onSubmit={handleSubmit} noValidate>
          {loginMode === 'rep' ? <>
          <div className="form-group">
            <label className="form-label" htmlFor="login-rep-name">Your name</label>
            <select id="login-rep-name" className="form-input" value={repName} onChange={(event) => setRepName(event.target.value)} required>
              <option value="">— Choose your name —</option>
              {repNames.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-pin">4-digit PIN</label>
            <input id="login-pin" className="form-input" inputMode="numeric" pattern="\d{4}" maxLength={4} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} required />
          </div>
          </> : <>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              className="form-input"
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          </>}

          <button className="btn btn--primary btn--block" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="login-page__hint">
          Account access is provisioned by an administrator. Disabled accounts
          cannot sign in.
        </p>

        {devAuth && (
          <aside className="login-page__dev-hint">
            <strong>Dev auth harness</strong>
            <p>
              Sign in with <code>admin@asg.local</code> / <code>admin123</code>,{' '}
              <code>manager@asg.local</code> / <code>manager123</code>,{' '}
              <code>rep@asg.local</code> / <code>rep123</code>, or the disabled
              account <code>disabled@asg.local</code> to verify blocked access.
            </p>
          </aside>
        )}
      </div>
    </main>
  )
}
