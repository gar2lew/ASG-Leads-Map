import { describe, expect, it } from 'vitest'
import { migrateLeadRecord, type LeadRecord } from './leadRegister'
import { countCallbacksDue, countCallsToday, orderCallerQueue, phoneHref } from './callQueue'

const now = new Date('2026-09-30T16:30:00.000Z') // 1 October in Perth and Brisbane

function lead(id: string, overrides: Partial<LeadRecord> = {}): LeadRecord {
  return migrateLeadRecord({ id, leadName: id, office: 'perth', callTimestamp: '2026-10-01T00:30', ...overrides })
}

describe('caller queue', () => {
  it('counts each actual call activity today and ignores default call timestamps and door knocks', () => {
    const untouched = lead('untouched')
    const called = lead('called', { activities: [
      { id: 'a', leadId: 'called', kind: 'call', occurredAt: '2026-09-30T16:05:00Z', repName: 'Jo', outcome: 'Connected', notes: '' },
      { id: 'b', leadId: 'called', kind: 'call', occurredAt: '2026-09-30T16:20:00Z', repName: 'Jo', outcome: 'No answer', notes: '' },
      { id: 'c', leadId: 'called', kind: 'door_knock', occurredAt: '2026-09-30T16:25:00Z', repName: 'Jo', outcome: 'Knocked', notes: '' },
      { id: 'd', leadId: 'called', kind: 'call', occurredAt: '2026-09-29T09:00:00Z', repName: 'Jo', outcome: 'Connected', notes: '' },
    ] })
    expect(countCallsToday([untouched, called], now)).toBe(2)
  })

  it('uses the lead office day at the UTC boundary', () => {
    const sameInstant = '2026-09-30T14:30:00Z' // 1 October Brisbane, 30 September Perth
    const activity = (leadId: string) => [{ id: leadId, leadId, kind: 'call' as const, occurredAt: sameInstant, repName: 'Jo', outcome: 'Connected', notes: '' }]
    expect(countCallsToday([
      lead('perth', { activities: activity('perth') }),
      lead('brisbane', { office: 'brisbane', activities: activity('brisbane') }),
    ], new Date('2026-09-30T14:45:00Z'))).toBe(2)
    expect(countCallsToday([
      lead('perth', { activities: activity('perth') }),
      lead('brisbane', { office: 'brisbane', activities: activity('brisbane') }),
    ], new Date('2026-09-30T16:30:00Z'))).toBe(1)
  })

  it('counts due callbacks against each office day', () => {
    expect(countCallbacksDue([
      lead('perth', { office: 'perth', qualification: 'callback', followUpDate: '2026-10-01' }),
      lead('brisbane', { office: 'brisbane', qualification: 'callback', followUpDate: '2026-10-01' }),
    ], new Date('2026-09-30T14:30:00Z'))).toBe(1)
  })

  it('orders overdue, due today, untouched new, future callback, active, then inactive with stable ties', () => {
    const oldCall = { id: 'past', leadId: 'called', kind: 'call' as const, occurredAt: '2026-09-20T02:00:00Z', repName: 'Jo', outcome: 'Connected', notes: '' }
    const records = [
      lead('active', { qualification: 'qualified' }),
      lead('future', { qualification: 'callback', followUpDate: '2026-10-03' }),
      lead('today', { qualification: 'callback', followUpDate: '2026-10-01' }),
      lead('old-new', { qualification: 'new', activities: [oldCall] }),
      lead('new-a'), lead('new-b'),
      lead('overdue-later', { qualification: 'callback', followUpDate: '2026-09-30' }),
      lead('archived', { qualification: 'archived' }),
      lead('overdue-earlier', { qualification: 'callback', followUpDate: '2026-09-28' }),
      lead('not-interested', { qualification: 'not_interested' }),
    ]
    expect(orderCallerQueue(records, now).map((record) => record.id)).toEqual([
      'overdue-earlier', 'overdue-later', 'today', 'new-a', 'new-b', 'future', 'active', 'old-new', 'archived', 'not-interested',
    ])
    expect(records[0]?.id).toBe('active')
  })

  it('sorts callbacks by each office date near midnight', () => {
    const atBoundary = new Date('2026-09-30T14:30:00Z')
    expect(orderCallerQueue([
      lead('perth', { office: 'perth', qualification: 'callback', followUpDate: '2026-10-01' }),
      lead('brisbane', { office: 'brisbane', qualification: 'callback', followUpDate: '2026-10-01' }),
    ], atBoundary).map((record) => record.id)).toEqual(['brisbane', 'perth'])
  })
})

describe('phone links', () => {
  it('keeps only an optional leading plus and digits', () => {
    expect(phoneHref(' +61 (4) 123-456-789 ')).toBe('tel:+614123456789')
    expect(phoneHref('abc')).toBeNull()
    expect(phoneHref('')).toBeNull()
  })
})
