/* ===========================================
   TERRITORY PERMISSIONS
   Uses existing RBAC from domain/roles
   =========================================== */

import type { Role } from './roles'

export type TerritoryPermission =
  | 'view'
  | 'create'
  | 'edit'
  | 'editOwn'
  | 'delete'
  | 'manageAssignments'

const rolePermissions: Record<Role, TerritoryPermission[]> = {
  super_admin: ['view', 'create', 'edit', 'editOwn', 'delete', 'manageAssignments'],
  manager: ['view', 'create', 'edit', 'editOwn', 'delete', 'manageAssignments'],
  rep: ['view'],
}

export function hasPermission(role: Role, permission: TerritoryPermission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

export function canManageTerritories(role: Role): boolean {
  return role === 'super_admin' || role === 'manager'
}

export function canEditTerritory(role: Role): boolean {
  if (role === 'super_admin') return true
  if (role === 'manager') return true
  return false
}

export function canDeleteTerritory(role: Role): boolean {
  return role === 'super_admin' || role === 'manager'
}

export function canViewAllTerritories(role: Role): boolean {
  return role === 'super_admin' || role === 'manager' || role === 'rep'
}
