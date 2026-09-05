import { describe, it, expect } from 'vitest'
import {
  Role,
  type Capability,
  ROLE_ORDER,
  roleLabel,
  isValidRole,
  USER_CAPABILITIES,
  OFFICE_IDS,
  hasCapability,
  canViewReports,
  canExportData,
  canViewTeam,
  canAssignAreas,
  canManageUsers,
  canManageSettings,
  canManageIntegrations,
} from './roles'

describe('Role', () => {
  it('defines the three roles', () => {
    expect(Role.SuperAdmin).toBe('super_admin')
    expect(Role.Manager).toBe('manager')
    expect(Role.Rep).toBe('rep')
  })
})

it('defines the initial office identifiers', () => {
  expect(OFFICE_IDS).toEqual(['perth', 'brisbane'])
})

describe('ROLE_ORDER', () => {
  it('orders roles super admin, manager, rep', () => {
    expect(ROLE_ORDER).toEqual([Role.SuperAdmin, Role.Manager, Role.Rep])
  })
})

describe('roleLabel', () => {
  it('labels each role', () => {
    expect(roleLabel(Role.SuperAdmin)).toBe('Super Admin')
    expect(roleLabel(Role.Manager)).toBe('Manager')
    expect(roleLabel(Role.Rep)).toBe('Rep')
  })

  it('throws for an invalid role', () => {
    expect(() => roleLabel('owner' as Role)).toThrow(/Invalid role/)
  })
})

describe('isValidRole', () => {
  it('accepts valid roles', () => {
    expect(isValidRole('super_admin')).toBe(true)
    expect(isValidRole('manager')).toBe(true)
    expect(isValidRole('rep')).toBe(true)
  })

  it('rejects invalid values', () => {
    expect(isValidRole('admin')).toBe(false)
    expect(isValidRole('owner')).toBe(false)
    expect(isValidRole('')).toBe(false)
    expect(isValidRole('ADMIN')).toBe(false)
    expect(isValidRole('Admin')).toBe(false)
  })
})

describe('hasCapability', () => {
  it('grants map:view and pins:create to every role', () => {
    ROLE_ORDER.forEach((role) => {
      expect(hasCapability(role, 'map:view')).toBe(true)
      expect(hasCapability(role, 'pins:create')).toBe(true)
    })
  })

  it('grants reports/data/team/areas to super admin and manager only', () => {
    const capabilities: Capability[] = ['reports:view', 'data:export', 'team:view', 'areas:assign']
    capabilities.forEach((capability) => {
      expect(hasCapability(Role.SuperAdmin, capability)).toBe(true)
      expect(hasCapability(Role.Manager, capability)).toBe(true)
      expect(hasCapability(Role.Rep, capability)).toBe(false)
    })
  })

  it('grants user/settings/integration management to super admin only', () => {
    const capabilities: Capability[] = ['users:manage', 'settings:manage', 'integrations:manage']
    capabilities.forEach((capability) => {
      expect(hasCapability(Role.SuperAdmin, capability)).toBe(true)
      expect(hasCapability(Role.Manager, capability)).toBe(false)
      expect(hasCapability(Role.Rep, capability)).toBe(false)
    })
  })
})

describe('capability helpers', () => {
  it('expose every capability with correct role coverage', () => {
    ROLE_ORDER.forEach((role) => {
      const isAdmin = role === Role.SuperAdmin
      const isManager = role === Role.Manager
      const isRep = role === Role.Rep
      expect(canViewReports(role)).toBe(isAdmin || isManager)
      expect(canExportData(role)).toBe(isAdmin || isManager)
      expect(canViewTeam(role)).toBe(isAdmin || isManager)
      expect(canAssignAreas(role)).toBe(isAdmin || isManager)
      expect(canManageUsers(role)).toBe(isAdmin)
      expect(canManageSettings(role)).toBe(isAdmin)
      expect(canManageIntegrations(role)).toBe(isAdmin && !isRep && !isManager)
    })
  })

  it('keeps helpers consistent with the capability table', () => {
    ROLE_ORDER.forEach((role) => {
      (Object.keys(USER_CAPABILITIES) as Capability[]).forEach((capability) => {
        const expectValue = (USER_CAPABILITIES[capability] as readonly Role[]).includes(role)
        let actualValue: boolean
        switch (capability) {
          case 'map:view': actualValue = hasCapability(role, capability); break
          case 'pins:create': actualValue = hasCapability(role, capability); break
          case 'reports:view': actualValue = canViewReports(role); break
          case 'data:export': actualValue = canExportData(role); break
          case 'team:view': actualValue = canViewTeam(role); break
          case 'areas:assign': actualValue = canAssignAreas(role); break
          case 'users:manage': actualValue = canManageUsers(role); break
          case 'settings:manage': actualValue = canManageSettings(role); break
          default: actualValue = canManageIntegrations(role); break
        }
        expect(actualValue).toBe(expectValue)
      })
    })
  })
})
