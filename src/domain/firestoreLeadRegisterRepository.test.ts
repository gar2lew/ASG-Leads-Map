import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Role, type CurrentUser } from './roles'
import { createFirestoreLeadRegisterRepository } from './firestoreLeadRegisterRepository'

const firestore = vi.hoisted(() => ({
  collection: vi.fn(() => 'leads-collection'),
  doc: vi.fn((_db: unknown, _collection: string, id?: string) => `lead-doc:${id || ''}`),
  where: vi.fn((field: string, op: string, value: string) => ({ field, op, value })),
  query: vi.fn((collection: unknown, ...constraints: unknown[]) => ({ collection, constraints })),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  arrayUnion: vi.fn((value: unknown) => ({ arrayUnion: value })),
  serverTimestamp: vi.fn(() => 'server-time'),
}))

vi.mock('firebase/firestore', () => firestore)

const activeRep: CurrentUser = {
  id: 'uid-perth', uid: 'uid-perth', name: 'Pat Rep', displayName: 'Pat Rep',
  email: 'pat@example.com', role: Role.Rep, active: true, officeId: 'perth',
}

function lead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-1', date: '2026-09-29', leadName: 'Ava', address: '1 Main St', phone: '0400000000',
    notes: '', updateLead: false, renterOwner: 'Owner', superannuation: '$75-150k', repName: 'Pat Rep',
    leadStatus: 'New', callTimestamp: '2026-09-29T09:00', callResult: '', leadId: 'external-1',
    office: 'perth', qualification: 'new', timelySynced: false, activities: [], ...overrides,
  }
}

describe('Firestore lead register repository', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    firestore.getDocs.mockResolvedValue({ docs: [] })
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ ...lead(), officeId: 'perth' }) })
    firestore.setDoc.mockResolvedValue(undefined)
    firestore.updateDoc.mockResolvedValue(undefined)
  })

  it('queries an active user’s office and maps Firestore officeId into lead records', async () => {
    firestore.getDocs.mockResolvedValue({ docs: [{ id: 'lead-1', data: () => ({ ...lead(), office: undefined, officeId: 'perth' }) }] })
    const repository = createFirestoreLeadRegisterRepository('db' as never, activeRep)

    const records = await repository.loadLeadRecords()

    expect(firestore.where).toHaveBeenCalledWith('officeId', '==', 'perth')
    expect(records[0]).toMatchObject({ id: 'lead-1', office: 'perth', leadName: 'Ava' })
  })

  it('fails closed for inactive users and regular users without an office', async () => {
    const inactive = createFirestoreLeadRegisterRepository('db' as never, { ...activeRep, active: false })
    const { officeId: _officeId, ...unassignedUser } = activeRep
    const unassigned = createFirestoreLeadRegisterRepository('db' as never, unassignedUser)

    await expect(inactive.loadLeadRecords()).rejects.toThrow(/active/i)
    await expect(unassigned.loadLeadRecords()).rejects.toThrow(/office/i)
    expect(firestore.getDocs).not.toHaveBeenCalled()
  })

  it('subscribes to the same office-scoped query and returns the unsubscribe function', () => {
    const unsubscribe = vi.fn()
    firestore.onSnapshot.mockReturnValue(unsubscribe)
    const repository = createFirestoreLeadRegisterRepository('db' as never, activeRep)
    const onRecords = vi.fn()
    const onError = vi.fn()

    const result = repository.subscribeLeadRecords(onRecords, onError)

    expect(firestore.where).toHaveBeenCalledWith('officeId', '==', 'perth')
    expect(result).toBe(unsubscribe)
    expect(firestore.onSnapshot).toHaveBeenCalledWith(expect.any(Object), expect.any(Function), onError)
  })

  it('preserves unchanged source metadata without writing it and rejects browser source edits', async () => {
    const repository = createFirestoreLeadRegisterRepository('db' as never, activeRep)
    const source = { spreadsheetId: 'sheet-1', tabName: 'LEADS', sourceRow: 2, lastSeenAt: 'now', snapshot: {}, conflicts: {} }

    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ ...lead(), officeId: 'perth', source }) })
    await repository.saveLeadRecord(lead({ source }) as never)
    expect(firestore.setDoc).toHaveBeenCalledWith('lead-doc:lead-1', expect.not.objectContaining({ source: expect.anything() }), { merge: true })

    firestore.setDoc.mockClear()
    await expect(repository.saveLeadRecord(lead({ source: { ...source, sourceRow: 3 } }) as never)).rejects.toThrow(/source/i)
    expect(firestore.setDoc).not.toHaveBeenCalled()
  })

  it('does not let general lead saves overwrite activity or Timely CRM state', async () => {
    const repository = createFirestoreLeadRegisterRepository('db' as never, activeRep)
    await repository.saveLeadRecord(lead({ activities: [{ id: 'stale-activity' }], timelySynced: true, timelySyncedAt: 'yesterday', timelySyncedBy: 'Old Rep' }) as never)

    expect(firestore.setDoc).toHaveBeenCalledWith('lead-doc:lead-1', expect.not.objectContaining({
      activities: expect.anything(), timelySynced: expect.anything(), timelySyncedAt: expect.anything(), timelySyncedBy: expect.anything(),
    }), { merge: true })
  })

  it('omits absent optional fields because Firestore rejects undefined values', async () => {
    const repository = createFirestoreLeadRegisterRepository('db' as never, activeRep)
    await repository.saveLeadRecord(lead() as never)
    const payload = firestore.setDoc.mock.calls[0]?.[1] as Record<string, unknown>

    expect(payload).not.toHaveProperty('followUpDate')
    expect(Object.values(payload).some((value) => value === undefined)).toBe(false)
  })

  it('rejects moving an existing record to another office', async () => {
    const repository = createFirestoreLeadRegisterRepository('db' as never, activeRep)
    firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ ...lead(), officeId: 'perth' }) })

    await expect(repository.saveLeadRecord(lead({ office: 'brisbane' }) as never)).rejects.toThrow(/office/i)
    expect(firestore.setDoc).not.toHaveBeenCalled()
  })

  it('keeps Timely CRM state while appending an activity', async () => {
    const repository = createFirestoreLeadRegisterRepository('db' as never, activeRep)
    const activity = { id: 'activity-1', leadId: 'lead-1', kind: 'call', occurredAt: '2026-09-29T10:00:00.000Z', repName: 'Pat Rep', outcome: 'Connected', notes: 'Callback requested' } as const

    await repository.addLeadActivity('lead-1', activity)

    expect(firestore.updateDoc).toHaveBeenCalledWith('lead-doc:lead-1', expect.objectContaining({
      activities: { arrayUnion: activity },
    }))
  })

  it('updates only linked map fields when a pin changes, leaving source and activity data untouched', async () => {
    const repository = createFirestoreLeadRegisterRepository('db' as never, activeRep)
    await repository.updateLeadFromPin('lead-1', {
      pinId: 'pin-7', latitude: -31.95, longitude: 115.86, pinOutcome: 'knocked', address: '2 Main St',
    })

    expect(firestore.updateDoc).toHaveBeenCalledWith('lead-doc:lead-1', expect.objectContaining({
      pinId: 'pin-7', pinIds: { arrayUnion: 'pin-7' }, latitude: -31.95, longitude: 115.86,
      pinOutcome: 'knocked', address: '2 Main St', updatedAt: 'server-time',
    }))
    const patch = firestore.updateDoc.mock.calls[0]?.[1] as Record<string, unknown>
    expect(patch).not.toHaveProperty('source')
    expect(patch).not.toHaveProperty('activities')
  })

  it('reflects door-knock outcomes in the shared lead map outcome', async () => {
    const repository = createFirestoreLeadRegisterRepository('db' as never, activeRep)
    await repository.addLeadActivity('lead-1', {
      id: 'knock-1', leadId: 'lead-1', kind: 'door_knock', occurredAt: '2026-09-29T10:00:00.000Z',
      repName: 'Pat Rep', outcome: 'Lead Qualified', notes: 'Booked an appointment',
    })

    expect(firestore.updateDoc).toHaveBeenCalledWith('lead-doc:lead-1', expect.objectContaining({ pinOutcome: 'lead' }))
  })

  it('writes only Timely handoff state through the dedicated action', async () => {
    const repository = createFirestoreLeadRegisterRepository('db' as never, activeRep)

    await repository.setTimelyHandoff('lead-1', true, 'Pat Rep', '2026-09-29T10:00:00.000Z')

    expect(firestore.updateDoc).toHaveBeenCalledWith('lead-doc:lead-1', {
      timelySynced: true, timelySyncedAt: '2026-09-29T10:00:00.000Z', timelySyncedBy: 'Pat Rep', updatedAt: 'server-time',
    })
  })
})
