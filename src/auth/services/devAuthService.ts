import { Role, type CurrentUser, isValidRole } from '../../domain/roles'
import { DEV_USERS } from '../currentUser'
import type { AuthService } from '../types'
import { AuthError } from '../types'
import {
  DEV_SESSION_KEY,
  DEV_SIGNED_OUT_KEY,
  findDevAccount,
} from './devStore'

/**
 * Isolated, in-memory auth harness used only when
 * `import.meta.env.DEV` is true and `VITE_USE_DEV_AUTH !== 'false'`.
 * Production builds never reach this code (dead-code eliminated).
 *
 * Behaviour:
 * - Auto-signs-in the seeded dev admin so existing tooling/E2E flows work
 *   without a login step.
 * - Persists the signed-in account in localStorage under DEV_SESSION_KEY so
 *   a page reload keeps the session.
 * - Respects the legacy `asg-dev-role` seed as a fallback (role coverage
 *   suites set this before first load).
 * - `getUser()` returns null once explicitly signed out, so the auth route
 *   guard can redirect to /login.
 */

function readSessionEmail(): string | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null
  }
  const session = window.localStorage.getItem(DEV_SESSION_KEY)
  // Treat explicit 'signed-out' marker as no session
  return session && session !== 'signed-out' ? session : null
}

function readSignedOut(): boolean {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return false
  }
  return window.localStorage.getItem(DEV_SIGNED_OUT_KEY) === 'true'
}

function readLegacyRole(): Role | null {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null
  }
  const stored = window.localStorage.getItem('asg-dev-role')
  return stored !== null && isValidRole(stored) ? stored : null
}

export function createDevAuthService(): AuthService {
  let resolved = false
  let user: CurrentUser | null = null
  const listeners = new Set<(user: CurrentUser | null) => void>()

  function emit(next: CurrentUser | null): void {
    listeners.forEach((listener) => listener(next))
  }

  function persistSession(email: string | null): void {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
      return
    }
    if (email) {
      window.localStorage.setItem(DEV_SESSION_KEY, email)
      window.localStorage.removeItem(DEV_SIGNED_OUT_KEY)
    } else {
      window.localStorage.removeItem(DEV_SESSION_KEY)
      window.localStorage.setItem(DEV_SIGNED_OUT_KEY, 'true')
    }
  }

  function resolveInitial(): CurrentUser | null {
    const sessionEmail = readSessionEmail()
    if (sessionEmail) {
      const account = findDevAccount(sessionEmail)
      if (account && !account.disabled) return account.user
    }
    // Explicitly signed out -> stay signed out on reload
    if (readSignedOut()) return null
    const legacyRole = readLegacyRole()
    return legacyRole ? DEV_USERS[legacyRole] : DEV_USERS[Role.SuperAdmin]
  }

  return {
    getUser() {
      if (!resolved) {
        user = resolveInitial()
        resolved = true
      }
      return user
    },
    onUserChanged(callback) {
      listeners.add(callback)
      // Call immediately with current user (mirrors Firebase onAuthStateChanged behavior)
      // Use setTimeout to ensure callback runs after current execution context
      setTimeout(() => callback(user), 0)
      return () => {
        listeners.delete(callback)
      }
    },
    async signIn(email, password) {
      const account = findDevAccount(email)
      if (!account || account.password !== password) {
        throw new AuthError('invalid-credentials', 'Invalid email or password.')
      }
      if (account.disabled) {
        throw new AuthError(
          'disabled-account',
          'This account has been disabled. Contact an administrator.',
        )
      }
      user = account.user
      resolved = true
      persistSession(user.email)
      emit(user)
      return user
    },
    async signOut() {
      user = null
      resolved = true
      persistSession(null)
      emit(null)
    },
    async getAccessToken() {
      return null
    },
  }
}
