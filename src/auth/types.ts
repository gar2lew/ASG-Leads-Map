import type { CurrentUser, OfficeId, Role } from '../domain/roles'

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out'

/**
 * Boundary for all authentication concerns. The app talks to this interface
 * only; the concrete implementation (Firebase vs dev harness) is selected by
 * `getAuthService()`.
 */
export interface AuthService {
  /** The currently signed-in user, or null when signed out / unknown. */
  getUser(): CurrentUser | null
  /** Subscribe to sign-in / sign-out changes. Returns an unsubscribe fn. */
  onUserChanged(callback: (user: CurrentUser | null) => void): () => void
  signIn(email: string, password: string): Promise<CurrentUser>
  signInWithPin(displayName: string, pin: string): Promise<{ user: CurrentUser; requiresPinSetup: boolean }>
  signOut(): Promise<void>
  /** Raw ID token used to authorize server API calls; null outside Firebase. */
  getAccessToken(): Promise<string | null>
}

export class AuthError extends Error {
  readonly kind: 'invalid-credentials' | 'disabled-account' | 'unknown'

  constructor(
    kind: 'invalid-credentials' | 'disabled-account' | 'unknown',
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
    this.kind = kind
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError
}

/** Firestore `users/{uid}` profile shape (common to all roles). */
export interface UserProfileRecord {
  uid: string
  email: string
  displayName: string
  role: Role
  active: boolean
  officeId?: OfficeId
  teamId?: string
  pinSetupRequired?: boolean
}

export interface CreateUserInput {
  email: string
  displayName: string
  role: Role
  officeId: OfficeId
  teamId?: string
}

export interface UpdateUserInput {
  email?: string
  displayName?: string
  role?: Role
  officeId?: OfficeId
  teamId?: string
  active?: boolean
}

export interface CreatedUserResult {
  user: UserProfileRecord
  /** One-time password returned from the server on creation. */
  temporaryPassword: string
}

/**
 * Boundary for admin user management. Production implementations call the
 * Vercel server functions for create/update (Admin SDK) and read profiles
 * from Firestore; the dev implementation works entirely in-memory.
 */
export interface UserAdminService {
  listUsers(): Promise<UserProfileRecord[]>
  createUser(input: CreateUserInput): Promise<CreatedUserResult>
  updateUser(uid: string, input: UpdateUserInput): Promise<UserProfileRecord>
  resetUserPassword(uid: string): Promise<{ temporaryPassword: string }>
}
