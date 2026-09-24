import { describe, expect, it } from 'vitest'
import { appendActivity, filterLeadRecords, migrateLeadRecord, type LeadActivity } from './leadRegister'

const base = migrateLeadRecord({
  id: 'lead-1',
  leadName: 'Ava Smith',
  address: '1 Main St',
  leadStatus: 'New',
  repName: 'Jordan',
  date: '2026-09-24',
})

describe('lead register domain model', () => {
  it('migrates legacy rows and preserves their identity', () => {
    const result = migrateLeadRecord({ id: 'legacy-1', leadName: 'Ava', address: '1 Main St' })

    expect(result.id).toBe('legacy-1')
    expect(result.leadStatus).toBe('New')
    expect(result.qualification).toBe('new')
    expect(result.timelySynced).toBe(false)
    expect(result.activities).toEqual([])
  })

  it('appends an activity without deleting the previous activity list', () => {
    const previous: LeadActivity = {
      id: 'activity-1', leadId: base.id, kind: 'call', occurredAt: '2026-09-23T09:00', repName: 'Jordan', outcome: 'No Answer', notes: 'Left voicemail',
    }
    const nextActivity: LeadActivity = {
      id: 'activity-2', leadId: base.id, kind: 'door_knock', occurredAt: '2026-09-24T10:00', repName: 'Jordan', outcome: 'Knocked', notes: 'Spoke at front door',
    }

    const next = appendActivity({ ...base, activities: [previous] }, nextActivity)

    expect(next.activities).toHaveLength(2)
    expect(next.activities[0]).toEqual(previous)
    expect(next.lastActivityAt).toBe(nextActivity.occurredAt)
    expect(next.leadStatus).toBe('New')
  })

  it('filters by search, status, office, Timely state, and callback date', () => {
    const records = [
      { ...base, office: 'perth' as const, qualification: 'callback' as const, followUpDate: '2026-09-24' },
      { ...base, id: 'lead-2', leadName: 'Ben Jones', office: 'brisbane' as const, timelySynced: true, timelySyncedAt: '2026-09-23T10:00', timelySyncedBy: 'Admin' },
    ]

    expect(filterLeadRecords(records, { query: 'Ava', office: 'perth', callbackDue: true }, '2026-09-24')).toHaveLength(1)
    expect(filterLeadRecords(records, { timely: 'sent' }, '2026-09-24')).toEqual([records[1]])
    expect(filterLeadRecords(records, { status: 'New' }, '2026-09-24')).toHaveLength(2)
    expect(filterLeadRecords([{ ...records[0]!, qualification: 'qualified' }], { status: 'Qualified' }, '2026-09-24')).toHaveLength(1)
  })
})
