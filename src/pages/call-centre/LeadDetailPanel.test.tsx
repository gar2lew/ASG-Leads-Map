import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { migrateLeadRecord } from '../../domain/leadRegister'
import { LeadDetailPanel } from './LeadDetailPanel'

const record = migrateLeadRecord({
  id: 'lead/42', leadName: 'Ava Smith', address: '1 Main Street, Perth', phone: '+61 412 345 678',
  qualification: 'callback', followUpDate: '2026-10-01', repName: 'Jordan', office: 'perth', timelySynced: false,
  activities: [{ id: 'activity-1', leadId: 'lead/42', kind: 'call', occurredAt: '2026-09-30T10:15', repName: 'Jordan', outcome: 'No Answer', notes: 'Try after 3 pm', followUpDate: '2026-10-01' }],
})

describe('LeadDetailPanel', () => {
  it('shows the selected lead context and append-only activity history', () => {
    render(<LeadDetailPanel record={record} onAddActivity={vi.fn()} onToggleTimely={vi.fn()} onPrevious={vi.fn()} onNext={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Ava Smith' })).toBeInTheDocument()
    expect(screen.getByText('Try after 3 pm')).toBeInTheDocument()
    expect(screen.getByText(/follow-up.*1 October 2026/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /call ava smith/i })).toHaveAttribute('href', 'tel:+61412345678')
  })

  it('renders local office timestamps as office wall time rather than the browser timezone', () => {
    const brisbaneRecord = migrateLeadRecord({ ...record, office: 'brisbane', activities: [{ id: 'office-time', leadId: record.id, kind: 'call', occurredAt: '2026-10-01T00:15', repName: 'Jordan', outcome: 'Connected', notes: '' }] })
    render(<LeadDetailPanel record={brisbaneRecord} onAddActivity={vi.fn()} onToggleTimely={vi.fn()} onPrevious={vi.fn()} onNext={vi.fn()} />)

    expect(screen.getByText('1 Oct · 12:15 am')).toBeInTheDocument()
  })

  it('opens the encoded lead map deep link in a safe new tab', () => {
    render(<LeadDetailPanel record={record} onAddActivity={vi.fn()} onToggleTimely={vi.fn()} onPrevious={vi.fn()} onNext={vi.fn()} />)

    expect(screen.getByRole('link', { name: /view ava smith on map/i })).toHaveAttribute('href', '/map?leadId=lead%2F42')
    expect(screen.getByRole('link', { name: /view ava smith on map/i })).toHaveAttribute('target', '_blank')
    expect(screen.getByRole('link', { name: /view ava smith on map/i })).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('keeps Timely CRM handoff as a manual marker and exposes queue navigation', () => {
    const onToggleTimely = vi.fn()
    const onPrevious = vi.fn()
    const onNext = vi.fn()
    render(<LeadDetailPanel record={record} onAddActivity={vi.fn()} onToggleTimely={onToggleTimely} onPrevious={onPrevious} onNext={onNext} />)

    fireEvent.click(screen.getByLabelText('Sent to Timely CRM'))
    fireEvent.click(screen.getByRole('button', { name: /previous lead/i }))
    fireEvent.click(screen.getByRole('button', { name: /next lead/i }))

    expect(onToggleTimely).toHaveBeenCalledWith(true)
    expect(onPrevious).toHaveBeenCalledOnce()
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('keeps address-only leads available for location review', () => {
    render(<LeadDetailPanel record={migrateLeadRecord({ ...record, id: 'address-only', leadName: '', latitude: undefined, longitude: undefined })} onAddActivity={vi.fn()} onToggleTimely={vi.fn()} onPrevious={vi.fn()} onNext={vi.fn()} />)

    expect(screen.getByText(/location needs review/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view lead on map/i })).toHaveAttribute('href', '/map?leadId=address-only')
  })
})
