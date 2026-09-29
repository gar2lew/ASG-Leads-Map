import type { Pin } from './pin'
import { leadSourceIdentityKey, migrateLeadRecord, type LeadOffice, type LeadRecord } from './leadRegister'
import { pinOutcomeLabel } from './pinOutcome'

export interface MigrationDuplicate {
  identity: string
  recordIds: string[]
  source: 'browser' | 'firestore'
}

export interface MigrationConflict {
  legacyRecordId: string
  firestoreRecordId: string
  fields: string[]
}

export interface UnmappedMigrationItem {
  id: string
  reason: string
}

export interface MigrationPreview {
  matched: Array<{ legacyRecordId: string; firestoreRecordId: string }>
  newRecords: LeadRecord[]
  recordsToWrite: LeadRecord[]
  duplicates: MigrationDuplicate[]
  conflicts: MigrationConflict[]
  unmappedRecords: UnmappedMigrationItem[]
  pinsMapped: number
  unmappedPins: UnmappedMigrationItem[]
}

export interface MigrationResult {
  savedRecords: LeadRecord[]
  savedCount: number
  failed: Array<{ recordId: string; reason: string }>
}

export interface MigrationRepository {
  saveLeadRecord(record: LeadRecord): Promise<LeadRecord>
}

const OPERATIONAL_FIELDS: Array<keyof LeadRecord> = [
  'leadName', 'address', 'phone', 'notes', 'updateLead', 'renterOwner', 'superannuation',
  'repName', 'leadStatus', 'callTimestamp', 'callResult', 'qualification', 'followUpDate',
]

function normaliseAddress(value: string | undefined): string {
  return (value || '').toLocaleLowerCase('en-AU').replace(/[^a-z0-9]+/g, ' ').trim()
}

function addressNameIdentity(office: LeadOffice, address: string | undefined, name: string | undefined): string {
  const normalisedAddress = normaliseAddress(address)
  const normalisedName = normaliseAddress(name)
  return normalisedAddress && normalisedName ? `${office}:address-name:${normalisedAddress}:${normalisedName}` : ''
}

function isOffice(value: unknown): value is LeadOffice {
  return value === 'perth' || value === 'brisbane'
}

function meaningful(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '' && value !== false
}

function mergeLegacyWithFirestore(legacy: LeadRecord, existing: LeadRecord): { record: LeadRecord; conflicts: string[] } {
  const merged = { ...legacy, ...existing, id: existing.id, office: existing.office }
  const conflicts: string[] = []
  for (const field of OPERATIONAL_FIELDS) {
    const oldValue = legacy[field]
    const currentValue = existing[field]
    if (!meaningful(currentValue) && meaningful(oldValue)) {
      Object.assign(merged, { [field]: oldValue })
    } else if (meaningful(oldValue) && meaningful(currentValue) && oldValue !== currentValue) {
      conflicts.push(String(field))
    }
  }
  merged.activities = [...existing.activities]
  const activityIds = new Set(merged.activities.map((activity) => activity.id))
  legacy.activities.forEach((activity) => {
    if (!activityIds.has(activity.id)) merged.activities.push(activity)
  })
  merged.lastActivityAt = existing.lastActivityAt || legacy.lastActivityAt
  merged.timelySynced = existing.timelySynced || legacy.timelySynced
  merged.timelySyncedAt = existing.timelySyncedAt || legacy.timelySyncedAt
  merged.timelySyncedBy = existing.timelySyncedBy || legacy.timelySyncedBy
  merged.source = existing.source
  return { record: merged, conflicts }
}

function makePinLead(pin: Pin, office: LeadOffice): LeadRecord {
  const qualification = pin.outcome === 'not_interested' ? 'not_interested' : pin.outcome === 'revisit' ? 'callback' : 'new'
  return migrateLeadRecord({
    id: `pin-${encodeURIComponent(pin.id)}`,
    leadId: pin.externalId || pin.id,
    leadName: pin.contactName || '',
    address: pin.address || '',
    phone: pin.contactPhone || '',
    notes: pin.notes || '',
    repName: '',
    leadStatus: pinOutcomeLabel(pin.outcome),
    callTimestamp: pin.createdAt.slice(0, 16),
    callResult: '',
    date: pin.createdAt.slice(0, 10),
    office,
    qualification,
    pinId: pin.id,
    pinIds: [pin.id],
    latitude: pin.latitude,
    longitude: pin.longitude,
    pinOutcome: pin.outcome,
  })
}

function withPin(record: LeadRecord, pin: Pin): LeadRecord {
  const pinIds = [...new Set([...(record.pinIds || []), ...(record.pinId ? [record.pinId] : []), pin.id])]
  const isPrimaryPin = !record.pinId || record.pinId === pin.id
  return {
    ...record,
    pinId: record.pinId || pin.id,
    pinIds,
    latitude: isPrimaryPin ? pin.latitude : record.latitude,
    longitude: isPrimaryPin ? pin.longitude : record.longitude,
    pinOutcome: isPrimaryPin ? pin.outcome : record.pinOutcome,
    address: record.address || pin.address || '',
    leadName: record.leadName || pin.contactName || '',
    phone: record.phone || pin.contactPhone || '',
    notes: record.notes || pin.notes || '',
  }
}

export function previewLegacyLeadMigration(input: {
  browserRecords: LeadRecord[]
  firestorePins: Pin[]
  firestoreLeads: LeadRecord[]
}): MigrationPreview {
  const matched: MigrationPreview['matched'] = []
  const newRecords: LeadRecord[] = []
  const recordsToWrite = new Map<string, LeadRecord>()
  const duplicates: MigrationDuplicate[] = []
  const conflicts: MigrationConflict[] = []
  const unmappedRecords: UnmappedMigrationItem[] = []
  const unmappedPins: UnmappedMigrationItem[] = []

  const existingByIdentity = new Map<string, LeadRecord[]>()
  const existingByAddressName = new Map<string, LeadRecord[]>()
  const existingById = new Map(input.firestoreLeads.map((record) => [record.id, record]))
  for (const existing of input.firestoreLeads) {
    if (!isOffice(existing.office)) continue
    const identity = leadSourceIdentityKey(existing.office, existing.leadId, existing.address, existing.leadName)
    if (identity) existingByIdentity.set(identity, [...(existingByIdentity.get(identity) || []), existing])
    const addressName = addressNameIdentity(existing.office, existing.address, existing.leadName)
    if (addressName) existingByAddressName.set(addressName, [...(existingByAddressName.get(addressName) || []), existing])
  }
  const duplicateFirestore = new Set<string>()
  for (const [identity, existing] of existingByIdentity) {
    if (existing.length > 1) {
      duplicateFirestore.add(identity)
      duplicates.push({ identity, recordIds: existing.map((record) => record.id), source: 'firestore' })
    }
  }

  const seenBrowser = new Map<string, string[]>()
  for (const legacy of input.browserRecords) {
    if (!isOffice(legacy.office)) {
      unmappedRecords.push({ id: legacy.id, reason: 'Office is missing or invalid.' })
      continue
    }
    const identity = leadSourceIdentityKey(legacy.office, legacy.leadId, legacy.address, legacy.leadName)
    if (!identity) {
      unmappedRecords.push({ id: legacy.id, reason: 'A LeadID or both lead name and address are required.' })
      continue
    }
    const addressName = addressNameIdentity(legacy.office, legacy.address, legacy.leadName)
    const seen = seenBrowser.get(identity)
    if (seen) {
      seen.push(legacy.id)
      duplicates.push({ identity, recordIds: [...seen], source: 'browser' })
      continue
    }
    seenBrowser.set(identity, [legacy.id])
    if (duplicateFirestore.has(identity)) {
      unmappedRecords.push({ id: legacy.id, reason: 'Multiple Firestore leads share this identity; resolve the duplicate first.' })
      continue
    }
    const identityMatches = existingByIdentity.get(identity) || []
    const addressNameMatches = existingByAddressName.get(addressName) || []
    const fallbackMatches = addressNameMatches.length === 1 ? addressNameMatches : []
    const existing = identityMatches[0] || fallbackMatches[0]
    if (identityMatches.length > 1 || (!identityMatches.length && addressNameMatches.length > 1)) {
      unmappedRecords.push({ id: legacy.id, reason: 'Multiple Firestore leads share this identity; resolve the duplicate first.' })
      continue
    }
    if (existing) {
      const merged = mergeLegacyWithFirestore(legacy, existing)
      matched.push({ legacyRecordId: legacy.id, firestoreRecordId: existing.id })
      if (merged.conflicts.length) conflicts.push({ legacyRecordId: legacy.id, firestoreRecordId: existing.id, fields: merged.conflicts })
      recordsToWrite.set(existing.id, merged.record)
    } else {
      const migrated = { ...legacy, source: undefined }
      if (existingById.has(migrated.id) || recordsToWrite.has(migrated.id)) {
        migrated.id = `migrated-lead-${encodeURIComponent(legacy.id)}`
        if (existingById.has(migrated.id) || recordsToWrite.has(migrated.id)) {
          unmappedRecords.push({ id: legacy.id, reason: 'A document ID collision prevents a safe migration.' })
          continue
        }
      }
      newRecords.push(migrated)
      recordsToWrite.set(migrated.id, migrated)
    }
  }

  let pinsMapped = 0
  const seenPins = new Set<string>()
  const allRecords = new Map(input.firestoreLeads.map((record) => [record.id, record]))
  recordsToWrite.forEach((record) => allRecords.set(record.id, record))
  for (const pin of input.firestorePins) {
    if (seenPins.has(pin.id)) {
      duplicates.push({ identity: `pin:${pin.id}`, recordIds: [pin.id], source: 'firestore' })
      continue
    }
    seenPins.add(pin.id)
    if (!isOffice(pin.officeId) || !normaliseAddress(pin.address)) {
      unmappedPins.push({ id: pin.id, reason: 'A valid office and property address are required to map this pin.' })
      continue
    }
    const sourceId = pin.externalId || pin.id
    const sourceMatch = [...allRecords.values()].find((record) => record.office === pin.officeId && record.leadId.trim().toLocaleLowerCase('en-AU') === sourceId.trim().toLocaleLowerCase('en-AU'))
    let candidates = [...allRecords.values()].filter((record) =>
      record.office === pin.officeId && normaliseAddress(record.address) === normaliseAddress(pin.address))
    if (pin.contactName) {
      const namedCandidates = candidates.filter((record) => normaliseAddress(record.leadName) === normaliseAddress(pin.contactName))
      if (namedCandidates.length) candidates = namedCandidates
    }
    const linked = [...allRecords.values()].find((record) => record.office === pin.officeId && (record.pinId === pin.id || record.pinIds?.includes(pin.id)))
    const target = linked || sourceMatch || (candidates.length === 1 ? candidates[0] : undefined)
    if (candidates.length > 1 && !linked && !sourceMatch) {
      unmappedPins.push({ id: pin.id, reason: 'More than one lead has this address; pin matching is ambiguous.' })
      continue
    }
    if (target) {
      const updated = withPin(target, pin)
      recordsToWrite.set(target.id, updated)
      allRecords.set(target.id, updated)
      pinsMapped++
      continue
    }
    const mapped = makePinLead(pin, pin.officeId)
    if (existingById.has(mapped.id) || recordsToWrite.has(mapped.id)) {
      mapped.id = `migrated-pin-${encodeURIComponent(pin.id)}`
      if (existingById.has(mapped.id) || recordsToWrite.has(mapped.id)) {
        unmappedPins.push({ id: pin.id, reason: 'A document ID collision prevents a safe pin migration.' })
        continue
      }
    }
    newRecords.push(mapped)
    recordsToWrite.set(mapped.id, mapped)
    allRecords.set(mapped.id, mapped)
    pinsMapped++
  }

  const finalRecords = [...recordsToWrite.values()]
  const finalRecordsById = new Map(finalRecords.map((record) => [record.id, record]))
  const finalNewRecords = newRecords.map((record) => finalRecordsById.get(record.id) || record)
  return { matched, newRecords: finalNewRecords, recordsToWrite: finalRecords, duplicates, conflicts, unmappedRecords, pinsMapped, unmappedPins }
}

export async function migrateLegacyLeadRecords(preview: MigrationPreview, repository: MigrationRepository): Promise<MigrationResult> {
  const savedRecords: LeadRecord[] = []
  const failed: MigrationResult['failed'] = []
  for (const record of preview.recordsToWrite) {
    try {
      savedRecords.push(await repository.saveLeadRecord(record))
    } catch (error) {
      failed.push({ recordId: record.id, reason: error instanceof Error ? error.message : 'Unknown migration error.' })
    }
  }
  return { savedRecords, savedCount: savedRecords.length, failed }
}
