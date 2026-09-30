import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Role, type CurrentUser } from '../domain/roles'
import { Layout } from './Layout'

let currentUser: CurrentUser = {
  id: 'rep', uid: 'rep', name: 'Field Rep', displayName: 'Field Rep',
  email: 'rep@example.com', role: Role.Rep, active: true,
}

vi.mock('../auth', () => ({
  useCurrentUser: () => currentUser,
  getAuthService: () => ({ signOut: vi.fn() }),
}))

afterEach(() => {
  localStorage.clear()
  currentUser = { ...currentUser, role: Role.Rep }
})

describe('signed-in workspace navigation', () => {
  it('lets a rep select Call Centre and remembers that choice', () => {
    render(<MemoryRouter initialEntries={['/map']}><Layout><div>Workspace content</div></Layout></MemoryRouter>)

    const switcher = screen.getByRole('navigation', { name: 'Workspaces' })
    const callCentre = within(switcher).getByRole('link', { name: 'Call Centre' })
    expect(switcher).toContainElement(callCentre)
    fireEvent.click(callCentre)
    expect(localStorage.getItem('asg-default-workspace')).toBe('contacts')
  })

  it('keeps Import among admin tools rather than daily workspaces', () => {
    currentUser = { ...currentUser, role: Role.SuperAdmin }
    render(<MemoryRouter initialEntries={['/map']}><Layout><div>Workspace content</div></Layout></MemoryRouter>)

    expect(screen.getByRole('navigation', { name: 'Workspaces' })).not.toHaveTextContent('Import')
    expect(screen.getByRole('navigation', { name: 'Administration' })).toHaveTextContent('Import Leads')
  })
})
