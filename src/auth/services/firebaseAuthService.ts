import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { getFirebaseApp } from '../../firebase/app'
import { getFirestoreDb } from '../../firebase/firestore'
import type { CurrentUser, OfficeId, Role } from '../../domain/roles'
import { isValidRole } from '../../domain/roles'
import type { AuthService } from '../types'
import { AuthError } from '../types'

function firebaseErrorToAuthError(error: unknown): AuthError {
  const code: string | undefined =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : undefined
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-email') {
    return new AuthError('invalid-credentials', 'Invalid email or password.')
  }
  if (code === 'auth/user-disabled') {
    return new AuthError('disabled-account', 'This account has been disabled. Contact an administrator.')
  }
  return new AuthError('unknown', 'Unable to sign in. Please try again.')
}

export interface StoredUserProfile {
  email?: string
  displayName?: string
  role?: string
  active?: boolean
  teamId?: string
  officeId?: OfficeId
}

export function profileToCurrentUser(uid: string, email: string, profile: StoredUserProfile | undefined): CurrentUser {
  const role: Role = profile && profile.role && isValidRole(profile.role) ? profile.role : 'rep'
  const active = profile?.active !== false
  const displayName = profile?.displayName ?? email
  const user: CurrentUser = {
    id: uid,
    uid,
    name: displayName,
    displayName,
    email,
    role,
    active,
  }
  if (profile && profile.teamId) user.teamId = profile.teamId
  if (profile?.officeId === 'perth' || profile?.officeId === 'brisbane') user.officeId = profile.officeId
  return user
}

/**
 * Loads the Firestore `users/{uid}` profile for an authenticated Firebase
 * user. Returns null when the profile is missing or the account is disabled
 * (both deny app access).
 */
export async function loadFirebaseProfile(uid: string, fallbackEmail: string): Promise<CurrentUser | null> {
  try {
    const db = getFirestoreDb()
    const snapshot = await getDoc(doc(db, 'users', uid))
    if (!snapshot.exists()) {
      return null
    }
    const profile = snapshot.data() as StoredUserProfile | undefined
    if (!profile || profile.active === false) {
      return null
    }
    return profileToCurrentUser(uid, profile.email ?? fallbackEmail, profile)
  } catch (error) {
    console.error('Failed to load user profile:', error)
    return null
  }
}

export function createFirebaseAuthService(): AuthService {
  const auth = getAuth(getFirebaseApp())
  let current: CurrentUser | null = null
  const listeners = new Set<(user: CurrentUser | null) => void>()

  function emit(next: CurrentUser | null): void {
    listeners.forEach((listener) => listener(next))
  }

  onAuthStateChanged(auth, (firebaseUser) => {
    if (!firebaseUser) {
      current = null
      emit(null)
      return
    }
    loadFirebaseProfile(firebaseUser.uid, firebaseUser.email ?? '').then((profileUser) => {
      if (!profileUser) {
        // Authenticated in Firebase but not provisioned: deny app access.
        // Always emit so AuthProvider cannot remain stuck in its initial
        // loading state when the profile is missing, disabled, or unreadable.
        current = null
        emit(null)
        return
      }
      current = profileUser
      emit(current)
    })
  })

  return {
    getUser() {
      return current
    },
    onUserChanged(callback) {
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
      }
    },
    async signIn(email, password) {
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password)
        const profileUser = await loadFirebaseProfile(credential.user.uid, credential.user.email ?? '')
        if (!profileUser) {
          throw new AuthError(
            'disabled-account',
            'This account is not provisioned or has been disabled. Contact an administrator.',
          )
        }
        current = profileUser
        emit(current)
        return current
      } catch (error) {
        if (error instanceof AuthError) throw error
        throw firebaseErrorToAuthError(error)
      }
    },
    async signOut() {
      await firebaseSignOut(auth)
    },
    async getAccessToken() {
      const token = await auth.currentUser?.getIdToken()
      return token ?? null
    },
  }
}
