import { Role, type CurrentUser } from '../domain/roles'

/**
 * Development-only user harness.
 *
 * Real authentication lives in `src/auth/services` (Firebase Auth + Firestore
 * profiles). This module exists so tools, tests and E2E suites can seed a
 * fixed role *before* the app authenticates, and to keep a source of truth for
 * the dev account fixtures used by the dev auth harness.
 *
 * It is only ever imported by `src/auth/services/*` (which the production
 * build never references thanks to `import.meta.env.DEV` dead-code
 * elimination) and by tests. Never import this module from production path
 * components.
 */

export const ASG_DEV_ROLE_KEY = 'asg-dev-role'

export const DEV_USERS: Record<Role, CurrentUser> = {
  [Role.SuperAdmin]: {
    id: 'dev-super-admin',
    uid: 'dev-super-admin',
    name: 'Admin User',
    displayName: 'Admin User',
    email: 'admin@asg.local',
    role: Role.SuperAdmin,
    active: true,
  },
  [Role.Manager]: {
    id: 'dev-manager',
    uid: 'dev-manager',
    name: 'Manager User',
    displayName: 'Manager User',
    email: 'manager@asg.local',
    role: Role.Manager,
    active: true,
  },
  [Role.Rep]: {
    id: 'dev-rep',
    uid: 'dev-rep',
    name: 'Rep User',
    displayName: 'Rep User',
    email: 'rep@asg.local',
    role: Role.Rep,
    active: true,
  },
}

/** Legacy dev fixture compat: a disabled rep account. */
export const DEV_DISABLED_USER: CurrentUser = {
  id: 'dev-disabled',
  uid: 'dev-disabled',
  name: 'Disabled User',
  displayName: 'Disabled User',
  email: 'disabled@asg.local',
  role: Role.Rep,
  active: false,
}

export function getCurrentUser(): CurrentUser {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return DEV_USERS[Role.SuperAdmin]
  }
  const stored = window.localStorage.getItem(ASG_DEV_ROLE_KEY)
  const role = stored !== null && isValidDevRole(stored) ? stored : Role.SuperAdmin
  return DEV_USERS[role]
}

export function setCurrentUserRole(role: Role): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
  window.localStorage.setItem(ASG_DEV_ROLE_KEY, role)
}

function isValidDevRole(value: string): value is Role {
  return value === Role.SuperAdmin || value === Role.Manager || value === Role.Rep
}
