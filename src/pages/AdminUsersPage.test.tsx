import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthProvider'
import type { CurrentUser } from '../domain/roles'
import type { UserProfileRecord } from '../auth/types'

const adminUser: CurrentUser = {
  id: 'admin-1',
  uid: 'admin-1',
  name: 'Admin One',
  displayName: 'Admin One',
  email: 'admin@asg.local',
  role: 'admin',
  active: true,
}

const repUser: UserProfileRecord = {
  uid: 'rep-1',
  email: 'rep@asg.local',
  displayName: 'Rep One',
  role: 'rep',
  active: true,
}

const mocks = vi.hoisted(() => {
  let currentUser: unknown = null
  let users: unknown[] = []
  const listeners = new Set<(user: unknown) => void>()
  return {
    authService: {
      getUser: vi.fn(() => currentUser),
      onUserChanged: vi.fn((callback: (user: unknown) => void) => {
        listeners.add(callback)
        return () => {
          listeners.delete(callback)
        }
      }),
      signIn: vi.fn(),
      signOut: vi.fn(),
      getAccessToken: vi.fn(async () => null),
      setUser: (user: unknown) => {
        currentUser = user
      },
      emit: (user: unknown) => {
        currentUser = user
        listeners.forEach((callback) => callback(user))
      },
    },
    userAdminService: {
      listUsers: vi.fn(async () => users),
      createUser: vi.fn(),
      updateUser: vi.fn(),
      setUsers: (list: unknown[]) => {
        users = list
      },
    },
  }
})

function seedUsers(list: unknown[]) {
  mocks.userAdminService.setUsers(list)
  mocks.userAdminService.listUsers.mockResolvedValue(list as never)
}

vi.mock('../auth/services', () => ({
  getAuthService: () => mocks.authService,
  getUserAdminService: () => mocks.userAdminService,
  isDevAuthActive: () => false,
}))

import { AdminUsersPage } from './AdminUsersPage'

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <AuthProvider>
        <Routes>
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/map" element={<div>MAP_STUB</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
  await act(async () => {})
  return userEvent.setup()
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authService.setUser(adminUser)
  seedUsers([adminUser as never, repUser])
})

describe('AdminUsersPage', () => {
  it('lists users with role, status and team columns', async () => {
    await renderPage()

    expect(screen.getByRole('region', { name: /user management/i })).toBeVisible()
    expect(screen.getByText('2 users')).toBeVisible()
    expect(await screen.findByText('Admin One')).toBeInTheDocument()
    expect(screen.getByText('Rep One')).toBeInTheDocument()
    expect(screen.getByText('admin@asg.local')).toBeInTheDocument()
    expect(screen.getAllByText('Active')).toHaveLength(2)
    const adminRow = screen.getByRole('row', { name: /Admin One/ })
    expect((within(adminRow).getByRole('option', { name: 'Admin' }) as HTMLOptionElement).selected).toBe(true)
  })

  it('creates a user and shows the temporary password', async () => {
    const user = await renderPage()
    mocks.userAdminService.createUser.mockResolvedValue({
      user: { uid: 'rep-2', email: 'jane@asg.local', displayName: 'Jane Rep', role: 'rep', active: true },
      temporaryPassword: 'temp-pass-123',
    })

    await user.click(screen.getByRole('button', { name: /add user/i }))
    await user.type(screen.getByLabelText('Email*'), 'jane@asg.local')
    await user.type(screen.getByLabelText('Display name*'), 'Jane Rep')
    await user.selectOptions(screen.getByLabelText('Role'), 'rep')
    await user.click(screen.getByRole('button', { name: /create user/i }))

    expect(mocks.userAdminService.createUser).toHaveBeenCalledWith({
      email: 'jane@asg.local',
      displayName: 'Jane Rep',
      role: 'rep',
    })

    const resultText = await screen.findByText(/share this one-time password/i)
    expect(resultText).toBeInTheDocument()
    expect(screen.getByText('temp-pass-123')).toBeInTheDocument()
  })

  it('deactivates a user and updates the status display', async () => {
    const user = await renderPage()
    mocks.userAdminService.updateUser.mockResolvedValue({
      ...repUser,
      active: false,
    })

    const repRow = screen.getByRole('row', { name: /Rep One/ })
    await user.click(within(repRow).getByRole('button', { name: /deactivate/i }))

    expect(mocks.userAdminService.updateUser).toHaveBeenCalledWith('rep-1', { active: false })
    expect(await within(repRow).findByText('Disabled')).toBeInTheDocument()
  })

  it('changes a user role through the row select', async () => {
    const user = await renderPage()
    mocks.userAdminService.updateUser.mockResolvedValue({
      ...repUser,
      role: 'manager',
    })

    await user.selectOptions(screen.getByLabelText('Role for rep@asg.local'), 'manager')

    expect(mocks.userAdminService.updateUser).toHaveBeenCalledWith('rep-1', { role: 'manager' })

    const repRow = screen.getByRole('row', { name: /Rep One/ })
    const managerOption = await within(repRow).findByRole('option', { name: 'Manager' })
    expect((managerOption as HTMLOptionElement).selected).toBe(true)
  })

  it('does not allow deactivating or changing the own role', async () => {
    await renderPage()

    const ownRow = screen.getByRole('row', { name: /Admin One/ })
    expect(within(ownRow).queryByRole('button', { name: /deactivate/i })).not.toBeInTheDocument()
    expect(within(ownRow).getByLabelText('Role for admin@asg.local')).toBeDisabled()
  })

  it('redirects a non-admin to the map', async () => {
    const rep: CurrentUser = {
      id: 'rep-1',
      uid: 'rep-1',
      name: 'Rep One',
      displayName: 'Rep One',
      email: 'rep@asg.local',
      role: 'rep',
      active: true,
    }
    mocks.authService.setUser(rep)

    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <AuthProvider>
          <Routes>
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/map" element={<div>MAP_STUB</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('MAP_STUB')).toBeInTheDocument()
  })
})
