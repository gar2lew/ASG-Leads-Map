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
  role: 'admin',
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
  mocks.service.setUser(null)
})

describe('LoginPage', () => {
  it('renders the sign-in form', async () => {
    const user = await renderLogin()

    expect(screen.getByRole('main')).toHaveClass('login-experience')
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()

    // No dev-hint box when the dev harness is inactive.
    expect(screen.queryByText(/Dev auth harness/i)).not.toBeInTheDocument()
    void user
  })

  it('shows an error for invalid credentials', async () => {
    const user = await renderLogin()
    mocks.service.signIn.mockRejectedValueOnce(
      new AuthError('invalid-credentials', 'Invalid email or password.'),
    )

    await user.type(screen.getByLabelText('Email'), 'nobody@asg.local')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.')
    expect(mocks.service.signIn).toHaveBeenCalledWith('nobody@asg.local', 'wrong')
  })

  it('shows the disabled-account message for a disabled account', async () => {
    const user = await renderLogin()
    mocks.service.signIn.mockRejectedValueOnce(
      new AuthError('disabled-account', 'This account has been disabled. Contact an administrator.'),
    )

    await user.type(screen.getByLabelText('Email'), 'disabled@asg.local')
    await user.type(screen.getByLabelText('Password'), 'disabled123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account has been disabled. Contact an administrator.',
    )
  })

  it('navigates to the map after a successful sign-in', async () => {
    const user = await renderLogin()
    mocks.service.signIn.mockResolvedValueOnce(adminUser)

    await user.type(screen.getByLabelText('Email'), 'admin@asg.local')
    await user.type(screen.getByLabelText('Password'), 'admin123')
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
