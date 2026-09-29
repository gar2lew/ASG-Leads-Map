import { describe, expect, it } from 'vitest'
import { Role, type CurrentUser } from './roles'
import { getAvailableWorkspaces } from './workspaces'

const user: CurrentUser = {
  id: 'field-user',
  uid: 'field-user',
  name: 'Field User',
  displayName: 'Field User',
  email: 'field@example.com',
  role: Role.Rep,
  active: true,
}

describe('getAvailableWorkspaces', () => {
  it.each([
    [Role.SuperAdmin, ['map', 'import', 'contacts']],
    [Role.Manager, ['map', 'contacts']],
    [Role.Rep, ['map', 'contacts']],
  ])('returns the exact workspace set for an active %s', (role, expected) => {
    expect(getAvailableWorkspaces({ ...user, role }).map((workspace) => workspace.id)).toEqual(expected)
  })

  it('keeps landing routes and required capabilities aligned with existing access', () => {
    expect(getAvailableWorkspaces({ ...user, role: Role.SuperAdmin })).toEqual([
      expect.objectContaining({ id: 'map', landingRoute: '/map', requiredCapability: 'map:view' }),
      expect.objectContaining({ id: 'import', landingRoute: '/admin/import', requiredCapability: 'users:manage' }),
      expect.objectContaining({ id: 'contacts', landingRoute: '/calls', requiredCapability: 'map:view' }),
    ])
  })

  it('provides a title and description for each visible workspace', () => {
    for (const workspace of getAvailableWorkspaces(user)) {
      expect(workspace.title.length).toBeGreaterThan(0)
      expect(workspace.description.length).toBeGreaterThan(0)
    }
  })

  it('hides every workspace from inactive users, including super admins', () => {
    expect(getAvailableWorkspaces({ ...user, role: Role.SuperAdmin, active: false })).toEqual([])
  })

  it.each([null, undefined])('fails closed while the profile is unresolved: %s', (profile) => {
    expect(getAvailableWorkspaces(profile)).toEqual([])
  })

  it('fails closed for an empty or unknown profile', () => {
    expect(getAvailableWorkspaces({} as CurrentUser)).toEqual([])
    expect(getAvailableWorkspaces({ ...user, role: 'unknown' as Role })).toEqual([])
  })
})
