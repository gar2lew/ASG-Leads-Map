import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthProvider'
import { AuthError } from '../auth/types'
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
  let currentUser: unknown = null
  const listeners = new Set<(user: unknown) => void>()
  return {
    service: {
      getUser: vi.fn(() => currentUser),
      onUserChanged: vi.fn((callback: (user: unknown) => void) => {
        listeners.add(callback)
        return () => {
          listeners.delete(callback)
        }
      }),
      signIn: vi.fn(async () => currentUser),
      signInWithAdminPin: vi.fn(async () => ({ user: currentUser, requiresPinSetup: false })),
      signOut: vi.fn(async () => {
        currentUser = null
      }),
      getAccessToken: vi.fn(async () => null),
      setUser: (user: unknown) => {
        currentUser = user
      },
      emit: (user: unknown) => {
        currentUser = user
        listeners.forEach((callback) => callback(user))
      },
    },
  }
})

vi.mock('../auth/services', () => ({
  getAuthService: () => mocks.service,
  isDevAuthActive: () => false,
}))

import { LoginPage } from './LoginPage'

async function renderLogin() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/map" element={<div>MAP_STUB</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
  // Resolve the provider out of its initial 'loading' state.
  await act(async () => {
    mocks.service.emit(null)
  })
  return userEvent.setup()
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.service.signIn.mockReset()
  mocks.service.signInWithAdminPin.mockReset()
  mocks.service.setUser(null)
})

describe('LoginPage', () => {
  it('renders the checklist-style administrator PIN form', async () => {
    const user = await renderLogin()

    expect(screen.getByRole('main')).toHaveClass('login-experience')
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
    expect(screen.getByText('Admin access')).toBeInTheDocument()
    expect(screen.getByLabelText('6-digit admin PIN')).toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()

    // No dev-hint box when the dev harness is inactive.
    expect(screen.queryByText(/Dev auth harness/i)).not.toBeInTheDocument()
    void user
  })

  it('shows an error for an invalid administrator PIN', async () => {
    const user = await renderLogin()
    mocks.service.signInWithAdminPin.mockRejectedValueOnce(
      new AuthError('invalid-credentials', 'Invalid administrator PIN.'),
    )

    await user.type(screen.getByLabelText('6-digit admin PIN'), '111111')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid administrator PIN.')
    expect(mocks.service.signInWithAdminPin).toHaveBeenCalledWith('111111')
  })

  it('shows the disabled-account message for an inactive administrator', async () => {
    const user = await renderLogin()
    mocks.service.signInWithAdminPin.mockRejectedValueOnce(
      new AuthError('disabled-account', 'This account has been disabled. Contact an administrator.'),
    )

    await user.type(screen.getByLabelText('6-digit admin PIN'), '111111')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account has been disabled. Contact an administrator.',
    )
  })

  it('navigates to the map after a successful sign-in', async () => {
    const user = await renderLogin()
    mocks.service.signInWithAdminPin.mockResolvedValueOnce({ user: adminUser, requiresPinSetup: false })

    await user.type(screen.getByLabelText('6-digit admin PIN'), '123456')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText('MAP_STUB')).toBeInTheDocument()
  })

  it('redirects to the map when already signed in', async () => {
    mocks.service.setUser(adminUser)

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/map" element={<div>MAP_STUB</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('MAP_STUB')).toBeInTheDocument()
  })
})
