import { searchAddress } from './geocoding'
import { isValidAustralianDate } from './date'
import { findLeadDuplicate, normaliseLeadAddress } from './leadImport'
import { leadSourceIdentityKey, type LeadOffice, type LeadSourceField, type LeadSourceMetadata, type LeadSourceSnapshot } from './leadRegister'
import { firstLeadValidationReason, normaliseOptionalText, validateLeadInput } from './leadValidation'
import { createPin, type Pin } from './pin'
import { PinOutcome, type PinOutcome as PinOutcomeValue } from './pinOutcome'
import { getAllPins, savePin } from './pinStorage'
import type { OfficeId } from './roles'

export interface LeadIngestionInput {
  address: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  notes?: string
  officeId: OfficeId
  source: 'manual' | 'jotform'
  externalId?: string
  outcome?: PinOutcomeValue
}

export interface LeadIngestionResult {
  status: 'created' | 'duplicate' | 'invalid' | 'geocoding-failed'
  pin?: Pin
  reason?: string
  dedupeKey?: string
}

export interface LeadIngestionDependencies {
  geocode: typeof searchAddress
  getAllPins: typeof getAllPins
  savePin: typeof savePin
}

const defaultDependencies: LeadIngestionDependencies = {
  geocode: searchAddress,
  getAllPins,
  savePin,
}

export interface SheetLeadSourceInput {
  office: LeadOffice
  spreadsheetId: string
  tabName: string
  sourceRow: number
  leadId?: string | undefined
  lastSeenAt: string
  fields: Partial<Record<LeadSourceField, unknown>>
}

const SOURCE_STATUSES = new Map([
  ['new', 'New'], ['lead', 'Lead'], ['qualified', 'Qualified'], ['callback', 'Callback'],
  ['appointment set', 'Appointment Set'], ['not interested', 'Not Interested'],
  ['no answer', 'No Answer'], ['revisit', 'Revisit'], ['wrong number', 'Wrong Number'],
  ['booked', 'Booked'],
])

function validIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function validSourceDate(value: string): boolean {
  return validIsoDate(value) || isValidAustralianDate(value)
}

function validSourceTimestamp(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](\d{2}):(\d{2}))?$/i.exec(value)
  if (!match || !match[1]) return false
  const offsetHours = match[5] === undefined ? 0 : Number(match[5])
  const offsetMinutes = match[6] === undefined ? 0 : Number(match[6])
  return validSourceDate(match[1]) && Number(match[2]) < 24 && Number(match[3]) < 60 &&
    (match[4] === undefined || Number(match[4]) < 60) &&
    offsetHours <= 14 && offsetMinutes < 60 && (offsetHours < 14 || offsetMinutes === 0)
}

export function projectSheetLeadSource(input: SheetLeadSourceInput): {
  identityKey: string | undefined
  office: LeadOffice
  source: LeadSourceMetadata
} {
  const snapshot: LeadSourceSnapshot = {}
  for (const [field, value] of Object.entries(input.fields) as Array<[LeadSourceField, unknown]>) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) continue
      if (field === 'updateLead') {
        if (/^(true|false)$/i.test(trimmed)) snapshot.updateLead = trimmed.toLowerCase() === 'true'
        continue
      }
      if (field === 'leadStatus') {
        const canonical = SOURCE_STATUSES.get(trimmed.toLowerCase().replace(/\s+/g, ' '))
        if (canonical) snapshot.leadStatus = canonical
        continue
      }
      if ((field === 'date' && !validSourceDate(trimmed)) ||
        (field === 'callTimestamp' && !validSourceTimestamp(trimmed)) ||
        (field === 'renterOwner' && !/^(owner|renter|tenant)$/i.test(trimmed))) continue
      if (field !== 'phone' || !validateLeadInput({
        address: 'source row',
        contactName: 'source contact',
        contactPhone: trimmed,
      }).contactPhone) Object.assign(snapshot, { [field]: trimmed })
    } else if (field === 'updateLead' && typeof value === 'boolean') {
      Object.assign(snapshot, { [field]: value })
    }
  }
  const leadId = input.leadId?.trim() || undefined
  return {
    identityKey: leadSourceIdentityKey(input.office, leadId, snapshot.address || '', snapshot.leadName || ''),
    office: input.office,
    source: {
      spreadsheetId: input.spreadsheetId,
      tabName: input.tabName,
      sourceRow: input.sourceRow,
      leadId,
      lastSeenAt: input.lastSeenAt,
      snapshot,
      conflicts: {},
    },
  }
}

export async function ingestLead(
  input: LeadIngestionInput,
  userId: string,
  dependencies: LeadIngestionDependencies = defaultDependencies,
): Promise<LeadIngestionResult> {
  const address = input.address.trim()
  const contactName = normaliseOptionalText(input.contactName)
  const contactPhone = normaliseOptionalText(input.contactPhone)
  const contactEmail = normaliseOptionalText(input.contactEmail)
  const notes = normaliseOptionalText(input.notes)

  const validationReason = firstLeadValidationReason(validateLeadInput({
    address,
    contactName,
    contactPhone,
    contactEmail,
  }))
  if (validationReason) return { status: 'invalid', reason: validationReason }

  const dedupeKey = normaliseLeadAddress(address)
  const externalId = normaliseOptionalText(input.externalId)
  const existingPins = await dependencies.getAllPins()
  const duplicate = findLeadDuplicate(existingPins, {
    address,
    source: input.source,
    externalId,
  })

  if (duplicate) {
    return {
      status: 'duplicate',
      dedupeKey: externalId && duplicate.source === input.source && duplicate.externalId === externalId
        ? externalId
        : dedupeKey,
    }
  }

  let geocodingResults: Awaited<ReturnType<typeof searchAddress>>
  try {
    geocodingResults = await dependencies.geocode(address)
  } catch (error) {
    return {
      status: 'geocoding-failed',
      reason: error instanceof Error ? error.message : 'Address could not be geocoded',
      dedupeKey,
    }
  }
  const geocoded = geocodingResults[0]
  if (!geocoded) {
    return { status: 'geocoding-failed', reason: 'Address could not be geocoded', dedupeKey }
  }

  const pin = createPin(
    {
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
      outcome: input.outcome ?? PinOutcome.Lead,
      address,
      notes,
      contactName,
      contactPhone,
      contactEmail,
      officeId: input.officeId,
      source: input.source,
      ...(externalId ? { externalId } : {}),
    },
    userId,
    input.officeId,
  )
  await dependencies.savePin(pin)

  return { status: 'created', pin, dedupeKey }
}
