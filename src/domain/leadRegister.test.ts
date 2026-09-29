import { describe, expect, it } from 'vitest'
import { appendActivity, filterLeadRecords, leadSourceIdentityKey, mergeLeadSource, migrateLeadRecord, type LeadActivity } from './leadRegister'

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
    expect(result.source).toBeUndefined()
  })

  it('keys source LeadID within an office and normalises the fallback address and name', () => {
    expect(leadSourceIdentityKey('perth', 'Lead-42', '1 Main St', 'Ava Smith')).toBe(
      leadSourceIdentityKey('perth', ' Lead-42 ', 'Different address', 'Different name'),
    )
    expect(leadSourceIdentityKey('brisbane', 'Lead-42', '1 Main St', 'Ava Smith')).not.toBe(
      leadSourceIdentityKey('perth', 'Lead-42', '1 Main St', 'Ava Smith'),
    )
    expect(leadSourceIdentityKey('perth', '', ' 1 MAIN St. ', ' Ava  Smith ')).toBe(
      leadSourceIdentityKey('perth', undefined, '1 main st', 'ava smith'),
    )
    expect(leadSourceIdentityKey('perth', '', '', 'Ava Smith')).toBeUndefined()
  })

  it('keeps source values separate from operational edits and preserves activities and Timely state', () => {
    const activity: LeadActivity = {
      id: 'activity-1', leadId: base.id, kind: 'call', occurredAt: '2026-09-24T10:00',
      repName: 'Jordan', outcome: 'Callback', notes: 'Spoke to customer',
    }
    const record = {
      ...base, leadName: 'App-edited name', phone: '0400 000 000', activities: [activity],
      timelySynced: true, timelySyncedAt: '2026-09-24T11:00', timelySyncedBy: 'Manager',
      source: {
        spreadsheetId: 'sheet-1', tabName: 'LEADS', sourceRow: 2, leadId: 'Lead-42',
        lastSeenAt: '2026-09-24T09:00:00.000Z', snapshot: { leadName: 'Ava Smith', phone: '0400 000 000', address: '1 Main St' },
        conflicts: {},
      },
    }
    const source = {
      ...record.source, lastSeenAt: '2026-09-25T09:00:00.000Z',
      snapshot: { leadName: 'Ava Jones', phone: '0400 111 111', address: '2 Main St' },
    }

    const merged = mergeLeadSource(record, source)
    expect(merged.leadName).toBe('App-edited name')
    expect(merged.phone).toBe('0400 111 111')
    expect(merged.address).toBe('2 Main St')
    expect(merged.source?.snapshot).toEqual(source.snapshot)
    expect(merged.source?.conflicts.leadName).toMatchObject({
      sourceValue: 'Ava Jones', operationalValue: 'App-edited name',
    })
    expect(merged.activities).toEqual([activity])
    expect(merged.timelySynced).toBe(true)
    expect(merged.timelySyncedAt).toBe('2026-09-24T11:00')
    expect(merged.timelySyncedBy).toBe('Manager')
    expect(mergeLeadSource(merged, source)).toEqual(merged)
  })
  it('keeps a deliberately cleared operational note when the sheet still has the old value', () => {
    const record = {
      ...base, notes: '',
      source: {
        spreadsheetId: 'sheet-1', tabName: 'LEADS', sourceRow: 2, leadId: 'Lead-42',
        lastSeenAt: '2026-09-24T09:00:00.000Z', snapshot: { notes: 'Old sheet note' }, conflicts: {},
      },
    }
    const incoming = {
      ...record.source, lastSeenAt: '2026-09-25T09:00:00.000Z', snapshot: { notes: 'Old sheet note' },
    }

    const merged = mergeLeadSource(record, incoming)
    expect(merged.notes).toBe('')
    expect(merged.source?.conflicts.notes).toMatchObject({
      sourceValue: 'Old sheet note', operationalValue: '',
    })
    expect(mergeLeadSource(merged, incoming)).toEqual(merged)
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
