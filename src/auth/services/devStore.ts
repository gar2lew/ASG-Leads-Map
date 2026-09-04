import { Role, type CurrentUser } from '../../domain/roles'
import {
  DEV_DISABLED_USER,
  DEV_USERS,
} from '../currentUser'

export interface DevAccount {
  email: string
  password: string
  user: CurrentUser
  disabled: boolean
}

export const DEV_SESSION_KEY = 'asg-dev-auth-user'
export const DEV_SIGNED_OUT_KEY = 'asg-dev-signed-out'
export const DEV_CREATED_PASSWORD = 'asg-dev123'

/**
 * Mutable, module-level account store shared by the dev auth harness and the
 * dev user-admin service, so accounts created at runtime can immediately
 * sign in. Reset on page reload (module re-instantiation), which is the
 * intended dev harness behaviour.
 */
export const DEV_ACCOUNTS: DevAccount[] = [
  {
    email: DEV_USERS[Role.SuperAdmin].email,
    password: 'admin123',
    user: DEV_USERS[Role.SuperAdmin],
    disabled: false,
  },
  {
    email: DEV_USERS[Role.Manager].email,
    password: 'manager123',
    user: DEV_USERS[Role.Manager],
    disabled: false,
  },
  {
    email: DEV_USERS[Role.Rep].email,
    password: 'rep123',
    user: DEV_USERS[Role.Rep],
    disabled: false,
  },
  {
    email: DEV_DISABLED_USER.email,
    password: 'disabled123',
    user: DEV_DISABLED_USER,
    disabled: true,
  },
]

export function findDevAccount(email: string): DevAccount | undefined {
  return DEV_ACCOUNTS.find((account) => account.email === email.trim().toLowerCase())
}

export function addDevAccount(account: DevAccount): void {
  DEV_ACCOUNTS.push(account)
}

export function findDevAccountByUid(uid: string): DevAccount | undefined {
  return DEV_ACCOUNTS.find((account) => account.user.uid === uid)
}
