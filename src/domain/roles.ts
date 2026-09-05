export const Role = {
  SuperAdmin: 'super_admin',
  Manager: 'manager',
  Rep: 'rep',
} as const

export type Role = (typeof Role)[keyof typeof Role]

export const OFFICE_IDS = ['perth', 'brisbane'] as const
export type OfficeId = (typeof OFFICE_IDS)[number]

export interface CurrentUser {
  /**
   * Backwards-compatible alias for the Firebase uid. `id === uid` for
   * Firebase-authenticated users; dev-harness users use stable dev ids.
   */
  id: string
  /** Firebase Authentication uid (or stable dev-harness id). */
  uid: string
  name: string
  displayName: string
  email: string
  role: Role
  active: boolean
  officeId?: OfficeId
  teamId?: string
}

export const ROLE_ORDER: Role[] = [Role.SuperAdmin, Role.Manager, Role.Rep]

const roleLabels: Record<Role, string> = {
  [Role.SuperAdmin]: 'Super Admin',
  [Role.Manager]: 'Manager',
  [Role.Rep]: 'Rep',
}

export function roleLabel(role: Role): string {
  const label = roleLabels[role]
  if (!label) {
    throw new Error(`Invalid role: ${role}`)
  }
  return label
}

export function isValidRole(value: string): value is Role {
  return value === Role.SuperAdmin || value === Role.Manager || value === Role.Rep
}

/**
 * Authoritative capability model.
 * Only check capabilities through these helpers - never scatter raw string
 * role checks throughout components.
 */
export const USER_CAPABILITIES = {
  'map:view': [Role.SuperAdmin, Role.Manager, Role.Rep],
  'pins:create': [Role.SuperAdmin, Role.Manager, Role.Rep],
  'reports:view': [Role.SuperAdmin, Role.Manager],
  'data:export': [Role.SuperAdmin, Role.Manager],
  'team:view': [Role.SuperAdmin, Role.Manager],
  'areas:assign': [Role.SuperAdmin, Role.Manager],
  'users:manage': [Role.SuperAdmin],
  'settings:manage': [Role.SuperAdmin],
  'integrations:manage': [Role.SuperAdmin],
} as const

export type Capability = keyof typeof USER_CAPABILITIES

export function hasCapability(role: Role, capability: Capability): boolean {
  return (USER_CAPABILITIES[capability] as readonly Role[]).includes(role)
}

export const canViewReports = (role: Role): boolean => hasCapability(role, 'reports:view')
export const canExportData = (role: Role): boolean => hasCapability(role, 'data:export')
export const canViewTeam = (role: Role): boolean => hasCapability(role, 'team:view')
export const canAssignAreas = (role: Role): boolean => hasCapability(role, 'areas:assign')
export const canManageUsers = (role: Role): boolean => hasCapability(role, 'users:manage')
export const canManageSettings = (role: Role): boolean => hasCapability(role, 'settings:manage')
export const canManageIntegrations = (role: Role): boolean => hasCapability(role, 'integrations:manage')
