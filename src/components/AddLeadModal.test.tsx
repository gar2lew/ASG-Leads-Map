import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddLeadModal } from './AddLeadModal'
import { ingestLead } from '../domain'
import type { Pin } from '../domain'

vi.mock('../domain', async () => {
  const actual = await vi.importActual<typeof import('../domain')>('../domain')
  return { ...actual, ingestLead: vi.fn() }
})

const createdPin: Pin = {
  id: 'lead-1',
  latitude: -31.9523,
  longitude: 115.8613,
  outcome: 'lead',
  address: '42 Smith Street, Joondalup WA 6027',
  notes: undefined,
  contactName: 'Ada Lovelace',
  contactPhone: undefined,
  contactEmail: undefined,
  officeId: 'perth',
  source: 'manual',
  createdBy: 'user-1',
  createdAt: '2026-09-17T00:00:00.000Z',
  updatedAt: '2026-09-17T00:00:00.000Z',
  synced: false,
  syncAttempts: 0,
}

function renderModal(overrides: Partial<React.ComponentProps<typeof AddLeadModal>> = {}) {
  const onClose = vi.fn()
  const onCreated = vi.fn()
  render(<AddLeadModal isOpen onClose={onClose} onCreated={onCreated} userId="user-1" officeId="perth" {...overrides} />)
  return { onClose, onCreated }
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/address/i), createdPin.address ?? '')
  await user.type(screen.getByLabelText(/contact name/i), createdPin.contactName ?? '')
}

describe('AddLeadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows validation errors when address or every contact detail is missing', async () => {
    const user = userEvent.setup()
    renderModal()

    expect(screen.getByRole('dialog', { name: /add lead/i })).toHaveClass('add-lead-modal--checklist')

    await user.click(screen.getByRole('button', { name: /create lead/i }))

    const dialog = screen.getByRole('dialog', { name: /add lead/i })
    const addressError = within(dialog).getByText(/address is required/i)
    expect(addressError).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/address/i)).toHaveAttribute('aria-invalid', 'true')
    expect(within(dialog).getByLabelText(/address/i)).toHaveAttribute('aria-describedby', addressError.id)
    expect(within(dialog).getByRole('group', { name: /contact details/i })).toHaveAttribute('aria-required', 'true')
    expect(within(dialog).getByText(/at least one contact detail is required/i)).toBeInTheDocument()
    expect(vi.mocked(ingestLead)).not.toHaveBeenCalled()
  })

  it('submits a manual lead, notifies the map, and closes the modal', async () => {
    vi.mocked(ingestLead).mockResolvedValueOnce({ status: 'created', pin: createdPin })
    const user = userEvent.setup()
    const { onClose, onCreated } = renderModal()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /create lead/i }))

    await waitFor(() => {
      expect(ingestLead).toHaveBeenCalledWith({
        address: createdPin.address,
        contactName: createdPin.contactName,
        contactPhone: '',
        contactEmail: '',
        notes: '',
        officeId: 'perth',
        source: 'manual',
      }, 'user-1')
      expect(onCreated).toHaveBeenCalledWith(createdPin)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  it.each([
    ['duplicate', { status: 'duplicate' as const }, /already exists/i],
    ['geocoding-failed', { status: 'geocoding-failed' as const }, /could not be located/i],
  ])('shows a clear error when ingestion returns %s', async (_status, result, expectedMessage) => {
    vi.mocked(ingestLead).mockResolvedValueOnce(result)
    const user = userEvent.setup()
    const { onClose, onCreated } = renderModal()

    await fillRequiredFields(user)
    await user.click(screen.getByRole('button', { name: /create lead/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(expectedMessage)
    expect(onCreated).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('only offers the current user office and submits that supported office', async () => {
    vi.mocked(ingestLead).mockResolvedValueOnce({ status: 'created', pin: createdPin })
    const user = userEvent.setup()
    renderModal()

    const office = screen.getByLabelText(/office/i)
    expect(within(office).getAllByRole('option')).toHaveLength(1)
    expect(within(office).getByRole('option', { name: 'Perth' })).toBeInTheDocument()
    expect(within(office).queryByRole('option', { name: 'Brisbane' })).not.toBeInTheDocument()

    await user.type(screen.getByLabelText(/address/i), createdPin.address ?? '')
    await user.type(screen.getByLabelText(/contact name/i), 'Ada Lovelace')
    await user.click(screen.getByRole('button', { name: /create lead/i }))

    await waitFor(() => expect(ingestLead).toHaveBeenCalledWith(
      expect.objectContaining({ officeId: 'perth' }),
      'user-1',
    ))
  })

  it('does not offer unsupported delivery when the user has no assigned office', () => {
    renderModal({ officeId: undefined })

    expect(screen.getByText(/assigned office is required to create leads/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create lead/i })).toBeDisabled()
    expect(within(screen.getByLabelText(/office/i)).queryByRole('option', { name: /perth|brisbane/i })).not.toBeInTheDocument()
  })

  it.each([
    ['email', 'not-an-email', /enter a valid email address/i],
    ['phone', '12345', /enter a valid australian phone number/i],
  ])('shows a field error for an invalid %s without submitting', async (field, value, message) => {
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText(/address/i), createdPin.address ?? '')
    await user.type(screen.getByLabelText(new RegExp(`contact ${field}`, 'i')), value)
    await user.click(screen.getByRole('button', { name: /create lead/i }))

    const input = screen.getByLabelText(new RegExp(`contact ${field}`, 'i'))
    const error = screen.getByText(message)
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toContain(error.id)
    expect(ingestLead).not.toHaveBeenCalled()
  })

  it.each([
    ['email', 'ada@example.com'],
    ['phone', '0412 345 678'],
  ])('submits a valid %s-only contact without changing its formatting', async (field, value) => {
    vi.mocked(ingestLead).mockResolvedValueOnce({ status: 'created', pin: createdPin })
    const user = userEvent.setup()
    renderModal()

    await user.type(screen.getByLabelText(/address/i), createdPin.address ?? '')
    await user.type(screen.getByLabelText(new RegExp(`contact ${field}`, 'i')), value)
    await user.click(screen.getByRole('button', { name: /create lead/i }))

    await waitFor(() => expect(ingestLead).toHaveBeenCalledWith(
      expect.objectContaining({ [`contact${field[0]?.toUpperCase()}${field.slice(1)}`]: value }),
      'user-1',
    ))
  })

  it('ignores Escape while a submission is in progress', async () => {
    vi.mocked(ingestLead).mockImplementationOnce(() => new Promise(() => undefined))
    const user = userEvent.setup()
    const { onClose } = renderModal()
    await fillRequiredFields(user)

    await user.click(screen.getByRole('button', { name: /create lead/i }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: /add lead/i })).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('focuses the first field, traps Tab, closes on Escape, and restores opener focus', async () => {
    const user = userEvent.setup()

    function Harness() {
      const [isOpen, setIsOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setIsOpen(true)}>Open lead form</button>
          <button type="button">Background action</button>
          <AddLeadModal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            onCreated={vi.fn()}
            userId="user-1"
            officeId="perth"
          />
        </>
      )
    }

    render(<Harness />)
    const opener = screen.getByRole('button', { name: /open lead form/i })
    await user.click(opener)

    expect(screen.getByLabelText(/address/i)).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: /close add lead form/i })).toHaveFocus()
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: /create lead/i })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: /close add lead form/i })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: /add lead/i })).not.toBeInTheDocument()
    expect(opener).toHaveFocus()
  })
})
