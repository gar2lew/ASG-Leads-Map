import { describe, expect, it, vi } from 'vitest'
import { migrateLeadRecord, type LeadRecord } from './leadRegister'
import type { Pin } from './pin'
import { migrateLegacyLeadRecords, previewLegacyLeadMigration } from './leadRegisterMigration'

function record(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return migrateLeadRecord({ id: 'legacy-1', office: 'perth', leadId: 'Lead-1', leadName: 'Ava', address: '1 Main St', ...overrides })
}

function pin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'pin-1', latitude: -31.95, longitude: 115.86, outcome: 'lead', address: '1 Main St', notes: 'Door knock',
    contactName: 'Ava', contactPhone: '0400000000', contactEmail: undefined, createdAt: '2026-09-28T10:00:00.000Z',
    updatedAt: '2026-09-28T10:00:00.000Z', createdBy: 'rep-1', officeId: 'perth', synced: true, syncAttempts: 0,
    ...overrides,
  }
}

describe('legacy lead register migration preview', () => {
  it('matches legacy contacts by office and lead identity without duplicating canonical leads', () => {
    const existing = record({ id: 'firestore-1', notes: 'Operational note' })
    const preview = previewLegacyLeadMigration({
      browserRecords: [record()], firestorePins: [], firestoreLeads: [existing],
    })

    expect(preview.matched).toHaveLength(1)
    expect(preview.newRecords).toHaveLength(0)
    expect(preview.recordsToWrite[0]).toMatchObject({ id: 'firestore-1', notes: 'Operational note' })
  })

  it('falls back to a unique office-scoped name and address when source IDs differ', () => {
    const existing = record({ id: 'firestore-1', leadId: 'generated-firestore-id' })
    const local = record({ id: 'generated-local-id', leadId: 'generated-local-id' })
    const preview = previewLegacyLeadMigration({ browserRecords: [local], firestorePins: [], firestoreLeads: [existing] })

    expect(preview.matched).toEqual([{ legacyRecordId: 'generated-local-id', firestoreRecordId: 'firestore-1' }])
    expect(preview.newRecords).toHaveLength(0)
  })

  it('does not overwrite an unrelated Firestore document with the same legacy id', () => {
    const unrelated = record({ id: 'legacy-1', leadId: 'different-source-id', leadName: 'Someone Else', address: '99 Other Rd' })
    const preview = previewLegacyLeadMigration({ browserRecords: [record()], firestorePins: [], firestoreLeads: [unrelated] })

    expect(preview.recordsToWrite).toHaveLength(1)
    expect(preview.recordsToWrite[0]?.id).not.toBe('legacy-1')
    expect(preview.newRecords[0]?.leadName).toBe('Ava')
  })

  it('reports duplicate browser identities and never proposes duplicate writes', () => {
    const preview = previewLegacyLeadMigration({
      browserRecords: [record(), record({ id: 'legacy-duplicate', leadName: 'AVA!', address: '1 MAIN ST' })],
      firestorePins: [], firestoreLeads: [],
    })

    expect(preview.newRecords).toHaveLength(1)
    expect(preview.duplicates).toHaveLength(1)
    expect(preview.recordsToWrite).toHaveLength(1)
  })

  it('retains separate browser leads at one address when their LeadIDs differ', () => {
    const preview = previewLegacyLeadMigration({
      browserRecords: [
        record({ leadId: 'lead-a', notes: 'First contact' }),
        record({ id: 'legacy-2', leadId: 'lead-b', notes: 'Second contact' }),
      ],
      firestorePins: [], firestoreLeads: [],
    })

    expect(preview.recordsToWrite).toHaveLength(2)
    expect(preview.recordsToWrite.map((item) => item.notes)).toEqual(['First contact', 'Second contact'])
  })

  it('maps unique-address pins onto the same lead record and creates stable records for unmatched pins', () => {
    const preview = previewLegacyLeadMigration({
      browserRecords: [record()],
      firestorePins: [pin(), pin({ id: 'pin-2', address: '99 Other Rd' })],
      firestoreLeads: [],
    })

    expect(preview.pinsMapped).toBe(2)
    expect(preview.unmappedPins).toHaveLength(0)
    expect(preview.recordsToWrite).toHaveLength(2)
    expect(preview.recordsToWrite).toContainEqual(expect.objectContaining({ id: 'legacy-1', pinId: 'pin-1', latitude: -31.95 }))
    expect(preview.recordsToWrite).toContainEqual(expect.objectContaining({ id: 'legacy-1', pinIds: ['pin-1'] }))
    expect(preview.recordsToWrite).toContainEqual(expect.objectContaining({ id: 'pin-pin-2', pinId: 'pin-2', address: '99 Other Rd' }))
  })

  it('preserves existing activities and Timely CRM handoff when merging legacy fields', () => {
    const existing = record({
      id: 'firestore-1', activities: [{ id: 'activity-1', leadId: 'firestore-1', kind: 'call', occurredAt: '2026-09-28T10:00:00Z', repName: 'Pat', outcome: 'Connected', notes: 'Call note' }],
      timelySynced: true, timelySyncedAt: '2026-09-28T11:00:00Z', timelySyncedBy: 'Pat',
    })
    const preview = previewLegacyLeadMigration({ browserRecords: [record({ notes: 'Legacy note' })], firestorePins: [], firestoreLeads: [existing] })

    expect(preview.recordsToWrite[0]).toMatchObject({
      id: 'firestore-1', notes: 'Legacy note', activities: [{ id: 'activity-1' }], timelySynced: true,
      timelySyncedBy: 'Pat',
    })
  })

  it('reports conflicts without replacing non-empty Firestore operational values', () => {
    const existing = record({ id: 'firestore-1', leadName: 'Ava Current', notes: 'Current note' })
    const preview = previewLegacyLeadMigration({
      browserRecords: [record({ leadName: 'Ava Legacy', notes: 'Legacy note' })], firestorePins: [], firestoreLeads: [existing],
    })

    expect(preview.conflicts[0]).toMatchObject({ firestoreRecordId: 'firestore-1', fields: expect.arrayContaining(['leadName', 'notes']) })
    expect(preview.recordsToWrite[0]).toMatchObject({ leadName: 'Ava Current', notes: 'Current note' })
  })

  it('matches a previously migrated pin by stable pinId on a repeated preview', () => {
    const first = previewLegacyLeadMigration({ browserRecords: [], firestorePins: [pin()], firestoreLeads: [] })
    const second = previewLegacyLeadMigration({ browserRecords: [], firestorePins: [pin()], firestoreLeads: first.recordsToWrite })

    expect(first.recordsToWrite).toHaveLength(1)
    expect(second.recordsToWrite).toHaveLength(1)
    expect(second.newRecords).toHaveLength(0)
    expect(second.recordsToWrite[0]?.id).toBe(first.recordsToWrite[0]?.id)
  })

  it('retains multiple pin links on a single matched lead without losing the original location', () => {
    const preview = previewLegacyLeadMigration({
      browserRecords: [record()], firestorePins: [pin(), pin({ id: 'pin-2', latitude: -31.96, longitude: 115.87 })], firestoreLeads: [],
    })
    const linked = preview.recordsToWrite.find((item) => item.id === 'legacy-1')

    expect(linked?.pinIds).toEqual(['pin-1', 'pin-2'])
    expect(linked?.latitude).toBe(-31.95)
  })

  it('is repeatable and does not delete local source data', async () => {
    const localRecords = [record()]
    localStorage.setItem('asg-call-log', JSON.stringify(localRecords))
    const repository = { saveLeadRecord: vi.fn(async (value: LeadRecord) => value) }
    const firstPreview = previewLegacyLeadMigration({ browserRecords: localRecords, firestorePins: [], firestoreLeads: [] })
    const first = await migrateLegacyLeadRecords(firstPreview, repository)
    const secondPreview = previewLegacyLeadMigration({ browserRecords: localRecords, firestorePins: [], firestoreLeads: first.savedRecords })
    const second = await migrateLegacyLeadRecords(secondPreview, repository)

    expect(first.savedCount).toBe(1)
    expect(secondPreview.newRecords).toHaveLength(0)
    expect(second.savedRecords).toHaveLength(1)
    expect(localStorage.getItem('asg-call-log')).toBe(JSON.stringify(localRecords))
  })

  it('reports records and pins that cannot be assigned safely', () => {
    const { office: _office, ...unassigned } = record()
    const unassignedPin = pin({ address: undefined })
    delete unassignedPin.officeId
    const preview = previewLegacyLeadMigration({
      browserRecords: [unassigned], firestorePins: [unassignedPin], firestoreLeads: [],
    })

    expect(preview.unmappedRecords).toHaveLength(1)
    expect(preview.unmappedPins).toHaveLength(1)
  })
})
