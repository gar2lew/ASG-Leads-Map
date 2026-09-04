import { Role, type Role as RoleType } from './roles'

export type ProtectedUserUpdate = {
  displayName?: string
  email?: string
  role?: string
  active?: boolean
}

export function validateManagedRole(role: string): RoleType {
  if (role !== Role.Manager && role !== Role.Rep) {
    throw new Error('Role must be Manager or Rep.')
  }
  return role
}

export function validateProtectedSuperAdminUpdate(
  currentRole: string,
  update: ProtectedUserUpdate,
): void {
  if (currentRole !== Role.SuperAdmin) return
  if (update.active === false) {
    throw new Error('The Super Admin account cannot be deactivated.')
  }
  if (update.role !== undefined && update.role !== Role.SuperAdmin) {
    throw new Error('The Super Admin role cannot be changed.')
  }
}
