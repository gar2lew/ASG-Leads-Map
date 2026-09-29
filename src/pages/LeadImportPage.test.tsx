import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const mocks = vi.hoisted(() => ({
  getAllPins: vi.fn(async () => []),
  ingestLead: vi.fn(),
  getSheetSyncStatus: vi.fn(),
  previewSheetBaseline: vi.fn(),
  confirmSheetBaseline: vi.fn(),
  syncSheetNow: vi.fn(),
  resolveSheetConflict: vi.fn(),
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

vi.mock('../integrations/sheetSync', () => ({
  getSheetSyncStatus: mocks.getSheetSyncStatus,
  previewSheetBaseline: mocks.previewSheetBaseline,
  confirmSheetBaseline: mocks.confirmSheetBaseline,
  syncSheetNow: mocks.syncSheetNow,
  resolveSheetConflict: mocks.resolveSheetConflict,
}))

import { LeadImportPage } from './LeadImportPage'

describe('LeadImportPage', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.ingestLead.mockResolvedValue({ status: 'created' })
    mocks.getSheetSyncStatus.mockResolvedValue({ office: 'perth', source: 'Perth live leads', url: 'https://example.test', baselineConfirmed: false, conflicts: [] })
    mocks.previewSheetBaseline.mockResolvedValue({ previewId: 'preview-1', office: 'perth', source: 'Perth live leads', counts: { inserted: 42, updated: 0, unchanged: 0, invalid: 0, duplicates: 1, conflicts: 0 }, conflicts: [], invalidRows: [], duplicates: [] })
    mocks.confirmSheetBaseline.mockResolvedValue({ summary: { office: 'perth', source: 'Perth live leads', syncedAt: '2026-09-30T10:00:00.000Z', inserted: 42, updated: 0, unchanged: 0, invalid: 0, duplicates: 1, conflicts: 0 }, conflicts: [] })
    mocks.syncSheetNow.mockResolvedValue({ summary: { office: 'perth', source: 'Perth live leads', syncedAt: '2026-09-30T10:00:00.000Z', inserted: 1, updated: 0, unchanged: 0, invalid: 0, duplicates: 0, conflicts: 0 }, conflicts: [] })
    mocks.resolveSheetConflict.mockResolvedValue({ resolved: true, recordId: 'lead-1', field: 'contactPhone', resolution: 'sheets' })
  })

  it('previews the live Sheets baseline before requiring explicit confirmation', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><LeadImportPage /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: /preview initial baseline/i }))

    expect(await screen.findByText(/review baseline before importing/i)).toBeInTheDocument()
    expect(screen.getByText(/nothing has been added yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm and import 42 leads/i })).toBeEnabled()
    expect(mocks.confirmSheetBaseline).not.toHaveBeenCalled()
  })

  it('confirms the reviewed baseline explicitly and refreshes status', async () => {
    mocks.getSheetSyncStatus
      .mockResolvedValueOnce({ office: 'perth', source: 'Perth live leads', url: 'https://example.test', baselineConfirmed: false, conflicts: [] })
      .mockResolvedValueOnce({ office: 'perth', source: 'Perth live leads', url: 'https://example.test', baselineConfirmed: true, conflicts: [] })
    const user = userEvent.setup()
    render(<MemoryRouter><LeadImportPage /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /preview initial baseline/i }))
    await user.click(await screen.findByRole('button', { name: /confirm and import 42 leads/i }))

    expect(mocks.confirmSheetBaseline).toHaveBeenCalledWith('perth', 'preview-1')
    expect(await screen.findByText(/firestore baseline active/i)).toBeInTheDocument()
  })

  it('refreshes the confirmed live register on demand', async () => {
    mocks.getSheetSyncStatus.mockResolvedValue({ office: 'perth', source: 'Perth live leads', url: 'https://example.test', baselineConfirmed: true, conflicts: [] })
    const user = userEvent.setup()
    render(<MemoryRouter><LeadImportPage /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: /sync live register now/i }))

    expect(mocks.syncSheetNow).toHaveBeenCalledWith('perth')
  })

  it('keeps the reviewed baseline preview available when confirmation needs retrying', async () => {
    mocks.confirmSheetBaseline.mockRejectedValueOnce(new Error('The register changed since preview.'))
    const user = userEvent.setup()
    render(<MemoryRouter><LeadImportPage /></MemoryRouter>)
    await user.click(await screen.findByRole('button', { name: /preview initial baseline/i }))
    await user.click(await screen.findByRole('button', { name: /confirm and import 42 leads/i }))

    expect(await screen.findByText('The register changed since preview.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm and import 42 leads/i })).toBeEnabled()
  })

  it('keeps baseline conflict choices read-only until confirmation persists them', async () => {
    mocks.previewSheetBaseline.mockResolvedValueOnce({
      previewId: 'preview-1', office: 'perth', source: 'Perth live leads', counts: { inserted: 0, updated: 0, unchanged: 1, invalid: 0, duplicates: 0, conflicts: 1 },
      conflicts: [{ recordId: 'lead-1', leadId: 'CRM-1', field: 'phone', operationalValue: '0400 111 111', sourceValue: '0400 222 222', sourceTab: 'LEADS', sourceRow: 8 }], invalidRows: [], duplicates: [],
    })
    const user = userEvent.setup()
    render(<MemoryRouter><LeadImportPage /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: /preview initial baseline/i }))

    expect(await screen.findByText(/resolution actions become available after the baseline is saved/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /keep firestore/i })).not.toBeInTheDocument()
  })

  it('shows row-level source diagnostics when a manual sync fails', async () => {
    mocks.getSheetSyncStatus.mockResolvedValue({ office: 'perth', source: 'Perth live leads', url: 'https://example.test', baselineConfirmed: true, conflicts: [] })
    mocks.syncSheetNow.mockRejectedValueOnce(Object.assign(new Error('Some source rows need correction.'), {
      invalidRows: [{ tabName: 'BOOKED', sourceRow: 9, reason: 'Address is required' }],
      invalidTabs: [{ tabName: 'NO ANSWER', reason: 'Expected headers are missing' }],
    }))
    const user = userEvent.setup()
    render(<MemoryRouter><LeadImportPage /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: /sync live register now/i }))

    expect(await screen.findByText(/BOOKED row 9: Address is required/i)).toBeInTheDocument()
    expect(screen.getByText(/NO ANSWER: Expected headers are missing/i)).toBeInTheDocument()
  })

  it('offers explicit resolution choices for source conflicts', async () => {
    const conflictStatus = {
      office: 'perth' as const, source: 'Perth live leads', url: 'https://example.test', baselineConfirmed: true, conflicts: [
        { recordId: 'lead-1', leadId: 'CRM-1', field: 'contactPhone', operationalValue: '0400 111 111', sourceValue: '0400 222 222', sourceTab: 'LEADS', sourceRow: 8 },
      ],
    }
    mocks.getSheetSyncStatus.mockResolvedValueOnce(conflictStatus).mockResolvedValueOnce({ ...conflictStatus, conflicts: [] })
    const user = userEvent.setup()
    render(<MemoryRouter><LeadImportPage /></MemoryRouter>)

    await user.click(await screen.findByRole('button', { name: /use sheets/i }))

    expect(mocks.resolveSheetConflict).toHaveBeenCalledWith({ office: 'perth', recordId: 'lead-1', field: 'contactPhone', resolution: 'sheets' })
    await waitFor(() => expect(screen.queryByText('0400 111 111')).not.toBeInTheDocument())
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
