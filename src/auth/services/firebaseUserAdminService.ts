import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { getFirestoreDb } from '../../firebase/firestore'
import type {
  CreatedUserResult,
  UserAdminService,
  UserProfileRecord,
} from '../types'

interface ProfileData {
  email?: string
  displayName?: string
  role?: string
  active?: boolean
  teamId?: string
  officeId?: 'perth' | 'brisbane'
  pinSetupRequired?: boolean
}

function isUserProfileRecord(value: unknown): value is UserProfileRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record['uid'] === 'string' &&
    typeof record['email'] === 'string' &&
    typeof record['displayName'] === 'string' &&
    typeof record['role'] === 'string' &&
    typeof record['active'] === 'boolean'
  )
}

async function requestError(response: Response): Promise<Error> {
  let message = 'Request failed. Please try again.'
  try {
    const body = (await response.json()) as { error?: string }
    if (body.error) message = body.error
  } catch {
    // fall back to the generic message
  }
  return new Error(message)
}

function toRecord(uid: string, data: ProfileData): UserProfileRecord {
  const record: UserProfileRecord = {
    uid,
    email: data.email ?? '',
    displayName: data.displayName ?? '',
    role: data.role === 'super_admin' || data.role === 'manager' || data.role === 'rep' ? data.role : 'rep',
    active: data.active !== false,
  }
  if (data.teamId) record.teamId = data.teamId
  if (data.officeId === 'perth' || data.officeId === 'brisbane') record.officeId = data.officeId
  if (data.pinSetupRequired !== undefined) record.pinSetupRequired = data.pinSetupRequired
  return record
}

/**
 * Production user-admin: reads profiles directly from Firestore (read path
 * is allowed by rules for admins) and delegates create/update to the Vercel
 * server functions, which authorize the caller via their ID token and write
 * using the Firebase Admin SDK.
 */
export function createFirebaseUserAdminService(getToken: () => Promise<string | null>): UserAdminService {
  async function requireToken(): Promise<string> {
    const token = await getToken()
    if (!token) throw new Error('Not signed in.')
    return token
  }

  return {
    async listUsers() {
      const db = getFirestoreDb()
      const snapshot = await getDocs(query(collection(db, 'users'), orderBy('displayName')))
      const users: UserProfileRecord[] = []
      snapshot.forEach((document) => {
        users.push(toRecord(document.id, document.data() as ProfileData))
      })
      return users
    },
    async createUser(input) {
      const token = await requireToken()
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        throw await requestError(response)
      }
      const body = (await response.json()) as { user?: unknown; temporaryPassword?: string }
      if (!body.user || !isUserProfileRecord(body.user) || typeof body.temporaryPassword !== 'string') {
        throw new Error('Unexpected create response.')
      }
      const result: CreatedUserResult = {
        user: body.user,
        temporaryPassword: body.temporaryPassword,
      }
      return result
    },
    async updateUser(uid, input) {
      const token = await requireToken()
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        throw await requestError(response)
      }
      const body = (await response.json()) as { user?: unknown }
      if (!body.user || !isUserProfileRecord(body.user)) {
        throw new Error('Unexpected update response.')
      }
      return body.user
    },
    async resetUserPassword(uid) {
      const token = await requireToken()
      const response = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw await requestError(response)
      const body = (await response.json()) as { temporaryPassword?: string }
      if (typeof body.temporaryPassword !== 'string') throw new Error('Unexpected password reset response.')
      return { temporaryPassword: body.temporaryPassword }
    },
  }
}
