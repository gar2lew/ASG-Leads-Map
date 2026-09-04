import { describe, expect, it } from 'vitest'
import { validateManagedRole, validateProtectedSuperAdminUpdate } from './userAdminPolicy'

describe('validateManagedRole', () => {
  it.each(['manager', 'rep'])('allows %s', (role) => {
    expect(validateManagedRole(role)).toBe(role)
  })

  it.each(['super_admin', 'admin', 'owner', ''])('rejects %s', (role) => {
    expect(() => validateManagedRole(role)).toThrow(/manager or rep/i)
  })
})

describe('validateProtectedSuperAdminUpdate', () => {
  it('prevents deactivation and downgrade of the super admin', () => {
    expect(() => validateProtectedSuperAdminUpdate('super_admin', { active: false })).toThrow(/deactivated/i)
    expect(() => validateProtectedSuperAdminUpdate('super_admin', { role: 'manager' })).toThrow(/role/i)
  })

  it('allows profile and email updates without changing protected access', () => {
    expect(() => validateProtectedSuperAdminUpdate('super_admin', {
      displayName: 'Garry',
      email: 'new@example.com',
      active: true,
      role: 'super_admin',
    })).not.toThrow()
  })
})
