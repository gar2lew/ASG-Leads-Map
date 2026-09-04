import { useEffect, useState, type ReactNode } from 'react'
import { AuthContext, type AuthState } from './AuthContext'
import type { CurrentUser } from '../domain/roles'
import { getAuthService } from './services'

/**
 * Owns the sign-in state for the whole app. Hooks into the active AuthService
 * and reflects sign-in / sign-out transitions to consumers.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const user: CurrentUser | null = getAuthService().getUser()
    return user ? { status: 'signed-in', user } : { status: 'loading', user: null }
  })

  useEffect(() => {
    const unsubscribe = getAuthService().onUserChanged((user) => {
      setState(user ? { status: 'signed-in', user } : { status: 'signed-out', user: null })
    })
    return unsubscribe
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}