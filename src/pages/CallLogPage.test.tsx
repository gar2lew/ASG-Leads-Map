import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CallLogPage } from './CallLogPage'

vi.mock('../auth', () => ({ useCurrentUser: () => ({ displayName: 'Jordan', email: 'jordan@example.com' }) }))

describe('CallLogPage', () => {
  beforeEach(() => localStorage.clear())

  it('captures a lead in the CRM-style workspace', async () => {
    render(<CallLogPage />)
    fireEvent.change(screen.getByLabelText('Lead name'), { target: { value: 'Ava Smith' } })
    fireEvent.change(screen.getByLabelText('Property address'), { target: { value: '1 Main St' } })
    fireEvent.click(screen.getByRole('button', { name: /save lead/i }))

    await waitFor(() => expect(screen.getByText('Ava Smith')).toBeInTheDocument())
    expect(screen.getByText(/Lead register/)).toBeInTheDocument()
  })

  it('exposes the Timely CRM handoff control', () => {
    render(<CallLogPage />)
    expect(screen.getByLabelText('Sent to Timely CRM')).toBeInTheDocument()
  })
})
