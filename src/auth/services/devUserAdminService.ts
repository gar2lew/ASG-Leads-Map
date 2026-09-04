import type { CurrentUser } from '../../domain/roles'
import { isValidRole } from '../../domain/roles'
import type {
  CreateUserInput,
  CreatedUserResult,
  UserAdminService,
  UserProfileRecord,
} from '../types'
import {
  DEV_ACCOUNTS,
  DEV_CREATED_PASSWORD,
  addDevAccount,
  findDevAccount,
  findDevAccountByUid,
} from './devStore'

function accountToRecord(uid: string): UserProfileRecord {
  const account = findDevAccountByUid(uid)
  if (!account) throw new Error('User not found.')
  const user = account.user
  const record: UserProfileRecord = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    active: !account.disabled,
  }
  if (user.teamId) record.teamId = user.teamId
  return record
}

function assertCreateInput(input: CreateUserInput): void {
  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address.')
  }
  if (!input.displayName.trim()) {
    throw new Error('Enter a display name.')
  }
  if (!isValidRole(input.role)) {
    throw new Error('Select a valid role.')
  }
  if (findDevAccount(email)) {
    throw new Error('A user with this email already exists.')
  }
}

export function createDevUserAdminService(): UserAdminService {
  return {
    async listUsers() {
      return DEV_ACCOUNTS.map((account) => accountToRecord(account.user.uid)).sort((a, b) =>
        a.displayName.localeCompare(b.displayName),
      )
    },
    async createUser(input) {
      assertCreateInput(input)
      const email = input.email.trim().toLowerCase()
      const uid = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const user: CurrentUser = {
        id: uid,
        uid,
        name: input.displayName.trim(),
        displayName: input.displayName.trim(),
        email,
        role: input.role,
        active: true,
      }
      if (input.teamId && input.teamId.trim()) {
        user.teamId = input.teamId.trim()
      }
      addDevAccount({
        email,
        password: DEV_CREATED_PASSWORD,
        user,
        disabled: false,
      })
      const account = findDevAccount(email)!
      const result: CreatedUserResult = {
        user: accountToRecord(account.user.uid),
        temporaryPassword: DEV_CREATED_PASSWORD,
      }
      return result
    },
    async updateUser(uid, input) {
      const account = findDevAccountByUid(uid)
      if (!account) throw new Error('User not found.')
      if (input.role !== undefined) {
        if (!isValidRole(input.role)) throw new Error('Select a valid role.')
        account.user.role = input.role
      }
      if (input.email !== undefined) {
        const email = input.email.trim().toLowerCase()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
        const duplicate = findDevAccount(email)
        if (duplicate && duplicate.user.uid !== uid) throw new Error('A user with this email already exists.')
        account.email = email
        account.user.email = email
      }
      if (input.displayName !== undefined && input.displayName.trim()) {
        account.user.displayName = input.displayName.trim()
        account.user.name = account.user.displayName
      }
      if (input.active !== undefined) {
        account.disabled = !input.active
        account.user.active = input.active
      }
      if (input.teamId !== undefined) {
        if (input.teamId.trim()) {
          account.user.teamId = input.teamId.trim()
        } else {
          delete (account.user as { teamId?: string }).teamId
        }
      }
      return accountToRecord(account.user.uid)
    },
    async resetUserPassword(uid) {
      const account = findDevAccountByUid(uid)
      if (!account) throw new Error('User not found.')
      account.password = DEV_CREATED_PASSWORD
      return { temporaryPassword: DEV_CREATED_PASSWORD }
    },
  }
}
