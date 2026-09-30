import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { LeadRecord } from '../domain/leadRegister'
import type { Pin } from '../domain/pin'
import { SelectedPinSheet } from './SelectedPinSheet'

const pin: Pin = {
  id: 'pin-1',
  latitude: -31.95,
  longitude: 115.86,
  outcome: 'lead',
  address: '9 Swan Street, Perth WA 6000',
  notes: 'Follow up on Friday',
  contactName: 'Jordan Example',
  contactPhone: '0412 345 678',
  contactEmail: undefined,
  createdAt: '2026-09-28T02:00:00.000Z',
  updatedAt: '2026-09-29T03:00:00.000Z',
  createdBy: 'Pat Rep',
  linkedLeadId: 'lead-1',
  synced: true,
  syncAttempts: 0,
}

const linkedLead: LeadRecord = {
  id: 'lead-1',
  date: '2026-09-28',
  leadName: 'Jordan Example',
  address: '9 Swan Street, Perth WA 6000',
  phone: '0412 345 678',
  notes: '',
  updateLead: false,
  renterOwner: 'Owner',
  superannuation: '$150-250k',
  repName: 'Pat Rep',
  leadStatus: 'Qualified',
  callTimestamp: '2026-09-29T03:00',
  callResult: 'Callback booked',
  leadId: 'external-lead-1',
  office: 'perth',
  pinId: 'pin-1',
  latitude: -31.95,
  longitude: 115.86,
  pinOutcome: 'lead',
  qualification: 'qualified',
  timelySynced: false,
  activities: [{
    id: 'activity-1', leadId: 'lead-1', kind: 'call', occurredAt: '2026-09-29T03:00:00.000Z',
    repName: 'Pat Rep', outcome: 'Callback booked', notes: 'Call again Friday morning.',
  }],
}

describe('SelectedPinSheet', () => {
  it('shows linked lead qualification and latest activity in the property context', () => {
    render(
      <SelectedPinSheet
        pin={pin}
        leadRecord={linkedLead}
        onUpdateOutcome={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const sheet = screen.getByRole('complementary', { name: /property details/i })
    expect(within(sheet).getByText('Qualified')).toBeVisible()
    expect(within(sheet).getByRole('heading', { name: /latest activity/i })).toBeVisible()
    expect(within(sheet).getByText('Callback booked')).toBeVisible()
    expect(within(sheet).getByText('Call again Friday morning.')).toBeVisible()
    expect(within(sheet).getAllByText('Pat Rep')).toHaveLength(2)
  })

  it('shows queued activity state without hiding existing property actions', () => {
    render(
      <SelectedPinSheet
        pin={{ ...pin, pendingLeadActivity: { recordId: 'lead-1', activity: linkedLead.activities[0]! } }}
        leadRecord={linkedLead}
        onUpdateOutcome={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    const sheet = screen.getByRole('complementary', { name: /property details/i })
    expect(within(sheet).getByRole('status')).toHaveTextContent(/activity sync pending/i)
    expect(within(sheet).getByRole('button', { name: /update outcome/i })).toBeEnabled()
  })

  it('routes the fast outcome action through the existing edit callback', async () => {
    const onUpdateOutcome = vi.fn()
    render(
      <SelectedPinSheet
        pin={pin}
        leadRecord={linkedLead}
        onUpdateOutcome={onUpdateOutcome}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    screen.getByRole('button', { name: /update outcome/i }).click()
    expect(onUpdateOutcome).toHaveBeenCalledTimes(1)
  })
})
