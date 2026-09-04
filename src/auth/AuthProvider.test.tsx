import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import type { CurrentUser } from '../domain/roles'

const adminUser: CurrentUser = {
  id: 'admin-1',
  uid: 'admin-1',
  name: 'Admin One',
  displayName: 'Admin One',
  email: 'admin@asg.local',
  role: 'super_admin',
  active: true,
}

const mocks = vi.hoisted(() => {
  let currentUser: ReturnType<typeof buildUser> | null = null
  const listeners = new Set<(user: ReturnType<typeof buildUser> | null) => void>()
  return {
    service: {
      getUser: vi.fn(() => currentUser),
      onUserChanged: vi.fn((callback: (user: ReturnType<typeof buildUser> | null) => void) => {
        listeners.add(callback)
        return () => {
          listeners.delete(callback)
        }
      }),
      signIn: vi.fn(),
      signOut: vi.fn(),
      getAccessToken: vi.fn(async () => null),
      setUser: (user: ReturnType<typeof buildUser> | null) => {
        currentUser = user
      },
      emit: (user: ReturnType<typeof buildUser> | null) => {
        currentUser = user
        listeners.forEach((callback) => callback(user))
      },
    },
  }
})

const buildUser = () => adminUser

vi.mock('./services', () => ({
  getAuthService: () => mocks.service,
}))

import { AuthProvider } from './AuthProvider'
import { useAuth, useCurrentUser } from './AuthContext'

function StatusProbe() {
  const { status } = useAuth()
  return <span>{status}</span>
}

function UserProbe() {
  const user = useCurrentUser()
  return <span>{user.name}</span>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.service.setUser(null)
})

describe('AuthProvider', () => {
  it('initialises as signed-in when the service already has a user', () => {
    mocks.service.setUser(adminUser)

    render(
      <AuthProvider>
        <StatusProbe />
        <UserProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('signed-in')).toBeInTheDocument()
    expect(screen.getByText('Admin One')).toBeInTheDocument()
    expect(mocks.service.onUserChanged).toHaveBeenCalledTimes(1)
  })

  it('starts loading then transitions to signed-in when the user resolves', async () => {
    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('loading')).toBeInTheDocument()

    await act(async () => {
      mocks.service.emit(adminUser)
    })

    expect(screen.getByText('signed-in')).toBeInTheDocument()
  })

  it('transitions to signed-out when the service reports no user', async () => {
    mocks.service.setUser(adminUser)

    render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )

    expect(screen.getByText('signed-in')).toBeInTheDocument()

    await act(async () => {
      mocks.service.emit(null)
    })

    expect(screen.getByText('signed-out')).toBeInTheDocument()
  })

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn()
    mocks.service.onUserChanged.mockReturnValueOnce(unsubscribe)
    mocks.service.setUser(adminUser)

    const { unmount } = render(
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>,
    )

    unmount()

    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
