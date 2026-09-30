import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Role, type CurrentUser } from '../domain/roles'
import { semanticThemeTokens } from '../theme/themeTokens'
import { Layout } from './Layout'

const repUser: CurrentUser = {
  id: 'rep', uid: 'rep', name: 'Field Rep', displayName: 'Field Rep',
  email: 'rep@example.com', role: Role.Rep, active: true,
}
let currentUser: CurrentUser = repUser

vi.mock('../auth', () => ({
  useCurrentUser: () => currentUser,
  getAuthService: () => ({ signOut: vi.fn() }),
}))

afterEach(() => {
  localStorage.clear()
  currentUser = repUser
})

describe('signed-in workspace navigation', () => {
  it('showsDailyWorkspaceSwitcher', () => {
    render(<MemoryRouter initialEntries={['/map']}><Layout><div>Workspace content</div></Layout></MemoryRouter>)

    expect(screen.getByLabelText('Current workspace')).toHaveTextContent('Field Workspace')
    const switcher = screen.getByRole('navigation', { name: 'Workspaces' })
    expect(within(switcher).getByRole('link', { name: 'Field Workspace' })).toHaveAttribute('href', '/map')
    expect(within(switcher).getByRole('link', { name: 'Call Centre' })).toHaveAttribute('href', '/calls')
    expect(within(switcher).getByRole('link', { name: 'Field Workspace' })).toHaveAttribute('aria-current', 'page')
  })

  it('groupsCapabilityFilteredAdminLinks', () => {
    currentUser = { ...currentUser, role: Role.SuperAdmin }
    render(<MemoryRouter initialEntries={['/calls']}><Layout><div>Workspace content</div></Layout></MemoryRouter>)

    const switcher = screen.getByRole('navigation', { name: 'Workspaces' })
    expect(switcher).not.toHaveTextContent('Import Leads')
    expect(screen.getByRole('button', { name: 'Administration' })).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'Administration' }))
    const admin = screen.getByRole('navigation', { name: 'Administration' })
    expect(within(admin).getByRole('link', { name: 'Import Leads' })).toHaveAttribute('href', '/admin/import')
    expect(within(admin).getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  })

  it('hidesRestrictedLinksUntilCapabilitiesResolve', () => {
    currentUser = { ...currentUser, role: Role.SuperAdmin, active: false }
    render(<MemoryRouter initialEntries={['/map']}><Layout><div>Workspace content</div></Layout></MemoryRouter>)

    expect(screen.queryByRole('button', { name: 'Administration' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Import Leads' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Workspaces' })).queryAllByRole('link')).toHaveLength(0)
  })

  it('persistsThemeChoice', () => {
    localStorage.setItem('asg-theme', 'light')
    render(<MemoryRouter initialEntries={['/map']}><Layout><div>Workspace content</div></Layout></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }))

    expect(localStorage.getItem('asg-theme')).toBe('dark')
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(document.documentElement.style.getPropertyValue('--asg-theme-canvas')).toBe(semanticThemeTokens.dark.canvas)
  })

  it('layoutThemeToggleAppliesAllSemanticColors', () => {
    localStorage.setItem('asg-theme', 'light')
    render(<MemoryRouter initialEntries={['/map']}><Layout><div>Workspace content</div></Layout></MemoryRouter>)

    fireEvent.click(screen.getByRole('button', { name: 'Toggle theme' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem('asg-theme')).toBe('dark')
    for (const [key, value] of Object.entries(semanticThemeTokens.dark)) {
      const property = `--asg-theme-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
      expect(document.documentElement.style.getPropertyValue(property)).toBe(value)
    }
  })

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
    fireEvent.click(screen.getByRole('button', { name: 'Administration' }))
    expect(screen.getByRole('navigation', { name: 'Administration' })).toHaveTextContent('Import Leads')
    expect(within(screen.getByRole('navigation', { name: 'Workspace navigation' })).queryByRole('link', { name: 'Import Leads' })).not.toBeInTheDocument()
  })
})
