import { describe, expect, it, vi } from 'vitest'
import { ingestLead } from './leadIngestion'
import type { Pin } from './pin'

const geocodingResult = {
  address: '10 Example Street, Perth WA 6000',
  latitude: -31.95,
  longitude: 115.86,
  source: 'manual' as const,
  confidence: 'manual' as const,
}

function pin(overrides: Partial<Pin> = {}): Pin {
  return {
    id: 'existing-pin',
    latitude: -31.95,
    longitude: 115.86,
    outcome: 'lead',
    address: '10 Example Street, Perth WA 6000',
    notes: undefined,
    contactName: 'Existing contact',
    contactPhone: undefined,
    contactEmail: undefined,
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
    createdBy: 'existing-user',
    synced: false,
    syncAttempts: 0,
    ...overrides,
  }
}

function dependencies(overrides: Partial<Parameters<typeof ingestLead>[2]> = {}) {
  return {
    geocode: vi.fn(async () => [geocodingResult]),
    getAllPins: vi.fn(async () => []),
    savePin: vi.fn(async () => undefined),
    ...overrides,
  }
}

const validInput = {
  address: '10 Example Street, Perth WA 6000',
  contactName: 'Ada Lovelace',
  officeId: 'perth' as const,
  source: 'manual' as const,
}

describe('ingestLead', () => {
  it('rejects a lead without an address or contact detail without saving', async () => {
    const deps = dependencies()

    const result = await ingestLead(
      { ...validInput, address: ' ', contactName: ' ' },
      'user-1',
      deps,
    )

    expect(result.status).toBe('invalid')
    expect(deps.geocode).not.toHaveBeenCalled()
    expect(deps.savePin).not.toHaveBeenCalled()
  })

  it('geocodes and saves a lead pin with its source, office, and creator', async () => {
    const deps = dependencies()

    const result = await ingestLead(validInput, 'user-1', deps)

    expect(result.status).toBe('created')
    expect(result.pin).toMatchObject({
      address: validInput.address,
      contactName: validInput.contactName,
      latitude: -31.95,
      longitude: 115.86,
      outcome: 'lead',
      source: 'manual',
      officeId: 'perth',
      createdBy: 'user-1',
    })
    expect(deps.savePin).toHaveBeenCalledWith(result.pin)
  })

  it('preserves a supplied Jotform outcome when saving the pin', async () => {
    const deps = dependencies()

    const result = await ingestLead(
      { ...validInput, source: 'jotform', outcome: 'not_interested' },
      'user-1',
      deps,
    )

    expect(result.pin).toMatchObject({ outcome: 'not_interested', source: 'jotform' })
  })

  it('does not save a lead whose normalised address already exists', async () => {
    const deps = dependencies({
      getAllPins: vi.fn(async () => [pin({ address: '10 EXAMPLE STREET perth wa 6000' })]),
    })

    const result = await ingestLead(validInput, 'user-1', deps)

    expect(result).toMatchObject({
      status: 'duplicate',
      dedupeKey: '10 example street perth wa 6000',
    })
    expect(deps.geocode).not.toHaveBeenCalled()
    expect(deps.savePin).not.toHaveBeenCalled()
  })

  it('does not save a lead whose source and external ID already exists', async () => {
    const deps = dependencies({
      getAllPins: vi.fn(async () => [pin({ source: 'jotform', externalId: 'submission-123' })]),
    })

    const result = await ingestLead(
      { ...validInput, source: 'jotform', externalId: 'submission-123' },
      'user-1',
      deps,
    )

    expect(result).toMatchObject({ status: 'duplicate', dedupeKey: 'submission-123' })
    expect(deps.geocode).not.toHaveBeenCalled()
    expect(deps.savePin).not.toHaveBeenCalled()
  })

  it('does not save when no address can be geocoded', async () => {
    const deps = dependencies({ geocode: vi.fn(async () => []) })

    const result = await ingestLead(validInput, 'user-1', deps)

    expect(result.status).toBe('geocoding-failed')
    expect(deps.savePin).not.toHaveBeenCalled()
  })

  it('returns a typed geocoding failure when the geocoder rejects', async () => {
    const deps = dependencies({
      geocode: vi.fn(async () => {
        throw new Error('Address search failed: 503')
      }),
    })

    const result = await ingestLead(validInput, 'user-1', deps)

    expect(result).toEqual({
      status: 'geocoding-failed',
      reason: 'Address search failed: 503',
      dedupeKey: '10 example street perth wa 6000',
    })
    expect(deps.savePin).not.toHaveBeenCalled()
  })

  it.each([
    [{ contactName: '', contactEmail: 'not-an-email' }, 'Enter a valid email address'],
    [{ contactName: '', contactPhone: '12345' }, 'Enter a valid Australian phone number'],
  ])('rejects an invalid supplied contact value without saving', async (contacts, reason) => {
    const deps = dependencies()

    const result = await ingestLead({ ...validInput, ...contacts }, 'user-1', deps)

    expect(result).toEqual({ status: 'invalid', reason })
    expect(deps.geocode).not.toHaveBeenCalled()
    expect(deps.savePin).not.toHaveBeenCalled()
  })

  it('accepts a name-only contact', async () => {
    const deps = dependencies()

    const result = await ingestLead({ ...validInput, contactPhone: '', contactEmail: '' }, 'user-1', deps)

    expect(result.status).toBe('created')
    expect(deps.savePin).toHaveBeenCalledOnce()
  })

  it.each([
    [{ contactName: '', contactEmail: 'ada@example.com' }, { contactEmail: 'ada@example.com' }],
    [{ contactName: '', contactPhone: '+61 412 345 678' }, { contactPhone: '+61 412 345 678' }],
  ])('accepts and preserves a valid email-only or phone-only contact', async (contacts, savedContact) => {
    const deps = dependencies()

    const result = await ingestLead({ ...validInput, ...contacts }, 'user-1', deps)

    expect(result).toMatchObject({ status: 'created', pin: savedContact })
    expect(deps.savePin).toHaveBeenCalledOnce()
  })
})
