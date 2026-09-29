import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CallLogPage } from './CallLogPage'

const mockRepo = vi.hoisted(() => ({
  subscribeLeadRecords: vi.fn(),
  saveLeadRecord: vi.fn(),
  addLeadActivity: vi.fn(),
  setTimelyHandoff: vi.fn(),
}))
const mockRecords = vi.hoisted(() => [] as Array<Record<string, unknown>>)
const mockListeners = vi.hoisted(() => [] as Array<(records: unknown[]) => void>)

vi.mock('../auth', () => ({ useCurrentUser: () => ({ uid: 'jordan-uid', id: 'jordan-uid', active: true, role: 'super_admin', officeId: 'perth', displayName: 'Jordan', name: 'Jordan', email: 'jordan@example.com' }), canManageIntegrations: () => true }))
vi.mock('../firebase/firestore', () => ({ getFirestoreDb: () => ({}) }))
vi.mock('../firebase/config', () => ({ isFirebaseConfigured: () => true }))
vi.mock('../domain/firestoreLeadRegisterRepository', () => ({ createFirestoreLeadRegisterRepository: () => mockRepo }))
vi.mock('../integrations/sheetSync', () => ({ syncSheetNow: vi.fn() }))

describe('CallLogPage', () => {
  beforeEach(() => {
    mockRecords.splice(0)
    mockListeners.splice(0)
    mockRepo.subscribeLeadRecords.mockImplementation((onRecords: (records: unknown[]) => void) => { mockListeners.push(onRecords); onRecords([...mockRecords]); return () => undefined })
    mockRepo.saveLeadRecord.mockImplementation(async (record: Record<string, unknown>) => { mockRecords.unshift(record); mockListeners.forEach((listener) => listener([...mockRecords])); return record })
    mockRepo.addLeadActivity.mockResolvedValue(undefined)
    mockRepo.setTimelyHandoff.mockResolvedValue(undefined)
    vi.clearAllMocks()
  })

  it('captures a lead in the CRM-style workspace', async () => {
    render(<CallLogPage />)
    fireEvent.change(screen.getByLabelText('Lead name'), { target: { value: 'Ava Smith' } })
    fireEvent.change(screen.getByLabelText('Property address'), { target: { value: '1 Main St' } })
    fireEvent.click(screen.getByRole('button', { name: /save lead/i }))

    await waitFor(() => expect(screen.getByText('Ava Smith')).toBeInTheDocument())
    expect(screen.getByText(/Lead register/)).toBeInTheDocument()
    expect(mockRepo.saveLeadRecord).toHaveBeenCalledWith(expect.objectContaining({ leadName: 'Ava Smith', office: 'perth' }))
  })

  it('exposes the Timely CRM handoff control', () => {
    render(<CallLogPage />)
    expect(screen.getByLabelText('Sent to Timely CRM')).toBeInTheDocument()
  })

  it('loads the live Firestore register and subscribes for changes', () => {
    render(<CallLogPage />)
    expect(mockRepo.subscribeLeadRecords).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('asg-call-log')).toBeNull()
  })

  it('renders a lead as soon as the shared Sheets subscription publishes it', async () => {
    render(<CallLogPage />)
    mockListeners.forEach((listener) => listener([{
      id: 'sheet-lead-1', date: '2026-09-29', leadName: 'Imported from Sheets', address: '2 Main St', phone: '', notes: '',
      updateLead: false, renterOwner: 'Owner', superannuation: '$75-150k', repName: 'Jordan', leadStatus: 'New',
      callTimestamp: '2026-09-29T09:00', callResult: '', leadId: 'sheet-1', office: 'perth', qualification: 'new', timelySynced: false, activities: [],
    }]))

    expect(await screen.findByText('Imported from Sheets')).toBeInTheDocument()
  })

  it('records the Timely handoff through the shared repository', async () => {
    mockRecords.push({
      id: 'shared-lead-1', date: '2026-09-29', leadName: 'Ava Smith', address: '1 Main St', phone: '', notes: '',
      updateLead: false, renterOwner: 'Owner', superannuation: '$75-150k', repName: 'Jordan', leadStatus: 'New',
      callTimestamp: '2026-09-29T09:00', callResult: '', leadId: 'external-1', office: 'perth', qualification: 'new', timelySynced: false, activities: [],
    })
    render(<CallLogPage />)
    fireEvent.click(screen.getByLabelText('Timely CRM'))

    await waitFor(() => expect(mockRepo.setTimelyHandoff).toHaveBeenCalledWith('shared-lead-1', true, 'Jordan'))
  })

  it('deduplicates repeated LeadIDs within one CSV import batch', async () => {
    render(<CallLogPage />)
    const csv = new File([
      'Lead Name,Address,LeadID\nAva Smith,1 Main St,external-1\nAva Smith Updated,1 Main St,external-1',
    ], 'leads.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText('Import register'), { target: { files: [csv] } })

    await waitFor(() => expect(mockRepo.saveLeadRecord).toHaveBeenCalledTimes(2))
    const [first, second] = mockRepo.saveLeadRecord.mock.calls.map(([record]) => record as Record<string, unknown>)
    expect(second?.['id']).toBe(first?.['id'])
    expect(second?.['leadName']).toBe('Ava Smith Updated')
  })

  it('appends a phone interaction to the selected shared lead ID', async () => {
    mockRecords.push({
      id: 'shared-lead-1', date: '2026-09-29', leadName: 'Ava Smith', address: '1 Main St', phone: '', notes: '',
      updateLead: false, renterOwner: 'Owner', superannuation: '$75-150k', repName: 'Jordan', leadStatus: 'New',
      callTimestamp: '2026-09-29T09:00', callResult: '', leadId: 'external-1', office: 'perth', qualification: 'new', timelySynced: false, activities: [],
    })
    render(<CallLogPage />)

    fireEvent.click(screen.getByRole('button', { name: /activity/i }))
    fireEvent.change(screen.getByLabelText('Outcome'), { target: { value: 'Connected' } })
    fireEvent.click(screen.getByRole('button', { name: /save activity/i }))

    await waitFor(() => expect(mockRepo.addLeadActivity).toHaveBeenCalledWith('shared-lead-1', expect.objectContaining({ kind: 'call', outcome: 'Connected' })))
  })
})
