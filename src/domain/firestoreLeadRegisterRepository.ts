import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { appendActivity, migrateLeadRecord, type LeadActivity, type LeadOffice, type LeadRecord } from './leadRegister'
import { PinOutcome } from './pinOutcome'
import { Role, type CurrentUser } from './roles'

type RecordInput = Partial<LeadRecord> & { id: string }
type Snapshot = {
  docs: Array<{ id: string; data(): Record<string, unknown> }>
}

function assertActive(user: CurrentUser): void {
  if (!user.active) throw new Error('An active user is required to access the lead register.')
}

function isOffice(value: unknown): value is LeadOffice {
  return value === 'perth' || value === 'brisbane'
}

function assertOfficeAccess(user: CurrentUser, office: unknown): asserts office is LeadOffice {
  assertActive(user)
  if (!isOffice(office)) throw new Error('A valid office is required for this lead.')
  if (user.role !== Role.SuperAdmin && user.officeId !== office) {
    throw new Error('You do not have access to this lead office.')
  }
}

function toLeadRecord(id: string, data: Record<string, unknown>): LeadRecord {
  const { officeId, ...record } = data
  return migrateLeadRecord({ ...record, id, office: isOffice(officeId) ? officeId : undefined } as RecordInput)
}

function mapSnapshot(snapshot: Snapshot): LeadRecord[] {
  return snapshot.docs.map((item) => toLeadRecord(item.id, item.data()))
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)) as Partial<T>
}

function pinOutcomeForActivity(activity: LeadActivity): PinOutcome | undefined {
  if (activity.kind !== 'door_knock') return undefined
  switch (activity.outcome.trim().toLocaleLowerCase('en-AU')) {
    case 'knocked': return PinOutcome.Knocked
    case 'no answer': return PinOutcome.NotKnocked
    case 'not interested': return PinOutcome.NotInterested
    case 'lead qualified':
    case 'appointment set': return PinOutcome.Lead
    case 'follow-up': return PinOutcome.Revisit
    default: return undefined
  }
}

export function createFirestoreLeadRegisterRepository(db: Firestore, user: CurrentUser) {
  const leads = collection(db, 'leads')

  function scopedQuery() {
    assertActive(user)
    if (user.role === Role.SuperAdmin) return query(leads)
    if (!user.officeId) throw new Error('An office assignment is required to access the lead register.')
    return query(leads, where('officeId', '==', user.officeId))
  }

  async function getAccessibleLead(recordId: string) {
    assertActive(user)
    const reference = doc(db, 'leads', recordId)
    const snapshot = await getDoc(reference)
    if (!snapshot.exists()) throw new Error('Lead record was not found.')
    const data = snapshot.data() as Record<string, unknown>
    assertOfficeAccess(user, data['officeId'])
    return { reference, data }
  }

  return {
    async loadLeadRecords(): Promise<LeadRecord[]> {
      return mapSnapshot(await getDocs(scopedQuery()) as Snapshot)
    },

    subscribeLeadRecords(onRecords: (records: LeadRecord[]) => void, onError?: (error: Error) => void): Unsubscribe {
      return onSnapshot(scopedQuery(), (snapshot) => onRecords(mapSnapshot(snapshot as Snapshot)), onError)
    },

    async saveLeadRecord(input: RecordInput): Promise<LeadRecord> {
      assertActive(user)
      const existingSnapshot = await getDoc(doc(db, 'leads', input.id))
      const existing = existingSnapshot.exists() ? existingSnapshot.data() as Record<string, unknown> : undefined
      const office = input.office ?? (isOffice(existing?.['officeId']) ? existing['officeId'] : undefined) ?? user.officeId
      assertOfficeAccess(user, office)
      if (existing && existing['officeId'] !== office) throw new Error('A lead cannot be moved to another office.')

      if (input.source !== undefined && JSON.stringify(input.source) !== JSON.stringify(existing?.['source'])) {
        throw new Error('Lead source metadata can only be changed by the server-side Sheets sync.')
      }

      const normalized = migrateLeadRecord({ ...input, office })
      const {
        id, office: _office, source: _source, activities: _activities,
        timelySynced: _timelySynced, timelySyncedAt: _timelySyncedAt,
        timelySyncedBy: _timelySyncedBy, lastActivityAt: _lastActivityAt,
        ...fields
      } = normalized
      await setDoc(doc(db, 'leads', id), {
        ...withoutUndefined(fields),
        officeId: office,
        updatedAt: serverTimestamp(),
        ...(!existing ? { createdAt: serverTimestamp() } : {}),
      }, { merge: true })
      return normalized
    },

    async addLeadActivity(recordId: string, activity: LeadActivity): Promise<void> {
      const { reference, data } = await getAccessibleLead(recordId)
      const current = toLeadRecord(recordId, data)
      const updated = appendActivity(current, activity)
      await updateDoc(reference, {
        activities: arrayUnion(activity),
        lastActivityAt: updated.lastActivityAt,
        ...(activity.kind === 'call' ? { callTimestamp: updated.callTimestamp, callResult: updated.callResult } : {}),
        ...(pinOutcomeForActivity(activity) ? { pinOutcome: pinOutcomeForActivity(activity) } : {}),
        ...(activity.notes ? { notes: activity.notes } : {}),
        ...(activity.followUpDate ? { followUpDate: activity.followUpDate } : {}),
        updatedAt: serverTimestamp(),
      })
    },

    async updateLeadFromPin(recordId: string, pin: {
      pinId: string
      latitude: number
      longitude: number
      pinOutcome: LeadRecord['pinOutcome']
      address?: string | undefined
      notes?: string | undefined
      leadName?: string | undefined
      phone?: string | undefined
    }): Promise<void> {
      const { reference } = await getAccessibleLead(recordId)
      await updateDoc(reference, {
        pinId: pin.pinId,
        pinIds: arrayUnion(pin.pinId),
        latitude: pin.latitude,
        longitude: pin.longitude,
        pinOutcome: pin.pinOutcome,
        ...(pin.address !== undefined ? { address: pin.address } : {}),
        ...(pin.notes !== undefined ? { notes: pin.notes } : {}),
        ...(pin.leadName !== undefined ? { leadName: pin.leadName } : {}),
        ...(pin.phone !== undefined ? { phone: pin.phone } : {}),
        updatedAt: serverTimestamp(),
      })
    },

    async setTimelyHandoff(recordId: string, sent: boolean, handoffUser: string, timestamp = new Date().toISOString()): Promise<void> {
      const { reference } = await getAccessibleLead(recordId)
      await updateDoc(reference, {
        timelySynced: sent,
        timelySyncedAt: sent ? timestamp : deleteField(),
        timelySyncedBy: sent ? handoffUser : deleteField(),
        updatedAt: serverTimestamp(),
      })
    },
  }
}
