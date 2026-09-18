import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../auth/AuthProvider'
import type { CurrentUser } from '../domain/roles'
import type { Pin } from '../domain/pin'
import { PinOutcome } from '../domain/pinOutcome'

const manager: CurrentUser = {
  id: 'manager-1', uid: 'manager-1', name: 'Manager', displayName: 'Manager',
  email: 'manager@asg.local', role: 'manager', active: true, officeId: 'perth',
}

const testPins: Pin[] = [
  {
    id: 'pin-1', latitude: -31.95, longitude: 115.86, outcome: PinOutcome.Lead,
    address: '1 Perth St', notes: undefined, contactName: undefined, contactPhone: undefined,
    contactEmail: undefined, createdAt: '2026-09-10T01:00:00.000Z', updatedAt: '2026-09-10T01:00:00.000Z',
    createdBy: 'rep-1', officeId: 'perth', synced: true, syncAttempts: 0,
  },
  {
    id: 'pin-2', latitude: -27.47, longitude: 153.03, outcome: PinOutcome.Knocked,
    address: '2 Brisbane St', notes: undefined, contactName: undefined, contactPhone: undefined,
    contactEmail: undefined, createdAt: '2026-09-09T01:00:00.000Z', updatedAt: '2026-09-09T01:00:00.000Z',
    createdBy: 'rep-2', officeId: 'brisbane', synced: true, syncAttempts: 0,
  },
]

const mocks = vi.hoisted(() => ({
  currentUser: null as unknown,
  getAllPins: vi.fn(async () => [] as Pin[]),
  listUsers: vi.fn(async () => [
    { uid: 'rep-1', displayName: 'Rep One', email: 'rep1@asg.local', role: 'rep', active: true },
    { uid: 'rep-2', displayName: 'Rep Two', email: 'rep2@asg.local', role: 'rep', active: true },
  ]),
  authService: {
    getUser: vi.fn(() => mocks.currentUser),
    onUserChanged: vi.fn(() => () => undefined),
  },
}))

vi.mock('../domain', async () => {
  const actual = await vi.importActual<typeof import('../domain')>('../domain')
  return { ...actual, getAllPins: mocks.getAllPins }
})
vi.mock('../auth/services', () => ({
  getAuthService: () => mocks.authService,
  getUserAdminService: () => ({ listUsers: mocks.listUsers }),
}))

import { DashboardPage } from './DashboardPage'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.currentUser = manager
  mocks.getAllPins.mockResolvedValue(testPins)
})

async function renderPage() {
  render(<MemoryRouter><AuthProvider><DashboardPage /></AuthProvider></MemoryRouter>)
  await act(async () => {})
  return userEvent.setup()
}

describe('DashboardPage', () => {
  it('resolves rep IDs and filters the report by office', async () => {
    const user = await renderPage()

    expect((await screen.findAllByText('Rep One')).length).toBeGreaterThan(0)
    expect(screen.getByText('Total Pins').parentElement).toHaveTextContent('2')

    await user.selectOptions(screen.getByLabelText('Office'), 'perth')

    expect(screen.getAllByText('Rep One').length).toBeGreaterThan(0)
    expect(screen.queryByText('Rep Two')).not.toBeInTheDocument()
  })

  it('exports the filtered report', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const user = await renderPage()

    await user.click(screen.getByRole('button', { name: 'Export Report' }))

    expect(click).toHaveBeenCalled()
    click.mockRestore()
  })
})
