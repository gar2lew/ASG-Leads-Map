import { createContext, useContext } from 'react'
import type { AuthStatus } from './types'
import type { CurrentUser } from '../domain/roles'

export interface AuthState {
  status: AuthStatus
  user: CurrentUser | null
}

export const AuthContext = createContext<AuthState>({ status: 'loading', user: null })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

/**
 * Returns the signed-in user. Throws outside of an authenticated route — all
 * current call sites render behind <RequireAuth />, which guarantees a
 * non-null user before mounting children.
 */
export function useCurrentUser(): CurrentUser {
  const { user } = useAuth()
  if (!user) {
    throw new Error(
      'useCurrentUser: no signed-in user. Render this component inside an authenticated route.',
    )
  }
  return user
}