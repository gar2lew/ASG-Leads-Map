import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, useCurrentUser } from '../auth'
import { hasCapability, type Capability } from '../domain/roles'
import { Layout } from './Layout'
import './RouteGuards.css'

export function AuthLoadingScreen() {
  return (
    <div className="auth-loading" role="status" aria-live="polite">
      <span className="auth-loading__spinner" aria-hidden="true" />
      <p className="auth-loading__text">Checking sign-in status…</p>
    </div>
  )
}

/**
 * Gate for the whole authenticated app tree. While the auth service is still
 * resolving the session it shows a loading screen; signed-out visitors are
 * redirected to /login (preserving their destination).
 */
export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <AuthLoadingScreen />
  }
  if (status === 'signed-out') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}

/**
 * Capability-gated wrapper. Users without the capability are pushed back to
 * the map.
 */
export function RequireRole({ capability, children }: { capability: Capability; children: ReactNode }) {
  const currentUser = useCurrentUser()
  if (!hasCapability(currentUser.role, capability)) {
    return <Navigate to="/map" replace />
  }
  return <>{children}</>
}