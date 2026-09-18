import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  getAllPins: vi.fn(async () => []),
  ingestLead: vi.fn(),
  parseLeadWorkbook: vi.fn(() => ({
    records: [{
      sourceRow: 2,
      sourceSheet: 'LEADS',
      officeId: 'perth' as const,
      leadId: 'jotform-123',
      address: '10 Example Street, Perth WA 6000',
      contactName: 'Ada Lovelace',
      contactPhone: '0400 000 000',
      notes: 'Requested a callback',
      sourceStatus: 'Booked',
      outcome: 'not_interested',
      dedupeKey: 'jotform-123',
    }],
    invalidRows: [] as Array<{ sheet: string; row: number; reason: string }>,
    duplicateCount: 0,
  })),
}))

vi.mock('../auth', () => ({
  useCurrentUser: () => ({ uid: 'admin-1', role: 'super_admin', officeId: 'perth' }),
}))

vi.mock('../domain', () => ({
  getAllPins: mocks.getAllPins,
  ingestLead: mocks.ingestLead,
  parseLeadWorkbook: mocks.parseLeadWorkbook,
  findImportedDuplicates: () => new Set(),
}))

import { LeadImportPage } from './LeadImportPage'

describe('LeadImportPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ingestLead.mockResolvedValue({ status: 'created' })
  })

  it('ingests Jotform records with their LeadID as the external ID', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><LeadImportPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText(/workbook/i), {
      target: { files: [{ name: 'master-leads.xlsx', arrayBuffer: async () => new ArrayBuffer(0) }] },
    })

    await user.click(await screen.findByRole('button', { name: /start master import/i }))

    await waitFor(() => {
      expect(mocks.ingestLead).toHaveBeenCalledWith({
        address: '10 Example Street, Perth WA 6000',
        contactName: 'Ada Lovelace',
        contactPhone: '0400 000 000',
        notes: 'Requested a callback · Imported from LEADS (Booked)',
        officeId: 'perth',
        source: 'jotform',
        externalId: 'jotform-123',
        outcome: 'not_interested',
      }, 'admin-1')
    })
  })

  it('counts duplicate ingestion results as skipped', async () => {
    const user = userEvent.setup()
    mocks.ingestLead.mockResolvedValue({ status: 'duplicate' })
    render(<MemoryRouter><LeadImportPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText(/workbook/i), {
      target: { files: [{ name: 'master-leads.xlsx', arrayBuffer: async () => new ArrayBuffer(0) }] },
    })

    await user.click(await screen.findByRole('button', { name: /start master import/i }))

    expect(await screen.findByText(/import complete/i, {}, { timeout: 2000 })).toHaveTextContent('0 records added; 1 skipped.')
  })

  it('counts geocoding-failed ingestion results as skipped after import pacing', async () => {
    vi.useFakeTimers()
    mocks.ingestLead.mockResolvedValue({ status: 'geocoding-failed' })
    render(<MemoryRouter><LeadImportPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText(/workbook/i), {
      target: { files: [{ name: 'master-leads.xlsx', arrayBuffer: async () => new ArrayBuffer(0) }] },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    fireEvent.click(screen.getByRole('button', { name: /start master import/i }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByLabelText('Import progress')).toHaveAttribute('value', '1')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100)
    })

    expect(screen.getByText(/import complete/i)).toHaveTextContent('0 records added; 1 skipped.')
  })

  it('shows sheet, row, and reason diagnostics for preview and ingestion failures', async () => {
    mocks.parseLeadWorkbook.mockReturnValueOnce({
      records: [{
        sourceRow: 2,
        sourceSheet: 'LEADS',
        officeId: 'perth',
        leadId: 'jotform-123',
        address: '10 Example Street, Perth WA 6000',
        contactName: 'Ada Lovelace',
        contactPhone: '',
        notes: '',
        sourceStatus: 'Booked',
        outcome: 'lead',
        dedupeKey: 'jotform-123',
      }],
      invalidRows: [{ sheet: 'NO ANSWER', row: 7, reason: 'At least one contact detail is required' }],
      duplicateCount: 0,
    })
    mocks.ingestLead.mockResolvedValueOnce({
      status: 'geocoding-failed',
      reason: 'Address search failed: 503',
    })
    const user = userEvent.setup()
    render(<MemoryRouter><LeadImportPage /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText(/workbook/i), {
      target: { files: [{ name: 'master-leads.xlsx', arrayBuffer: async () => new ArrayBuffer(0) }] },
    })

    expect(await screen.findByText(/NO ANSWER row 7: At least one contact detail is required/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /start master import/i }))

    expect(await screen.findByText(/LEADS row 2: Address search failed: 503/i, {}, { timeout: 2000 })).toBeInTheDocument()
  })
})
