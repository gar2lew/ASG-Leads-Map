import { searchAddress } from './geocoding'
import { findLeadDuplicate, normaliseLeadAddress } from './leadImport'
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
