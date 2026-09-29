import { describe, expect, it } from 'vitest'
import { countLeadsNeedingLocation, leadToMapPin, mergeCachedAndRemotePins, mergeLeadMapPins } from './leadMapProjection'
import { migrateLeadRecord } from './leadRegister'
import { PinOutcome } from './pinOutcome'
import type { Pin } from './pin'

const lead = (values: Record<string, unknown> = {}) => migrateLeadRecord({ id: 'lead-1', leadName: 'Ava', address: '1 Main St', office: 'perth', ...values })

describe('lead map projection', () => {
  it('projects only leads with valid coordinates and retains their stable pin identity', () => {
    expect(leadToMapPin(lead())).toBeNull()
    expect(leadToMapPin(lead({ pinId: 'pin-1', latitude: -31.95, longitude: 115.86, pinOutcome: PinOutcome.Knocked }))).toMatchObject({
      id: 'pin-1', linkedLeadId: 'lead-1', address: '1 Main St', latitude: -31.95, longitude: 115.86, outcome: PinOutcome.Knocked, officeId: 'perth',
    })
  })

  it('keeps non-geocoded leads in the register and reports them for review', () => {
    expect(countLeadsNeedingLocation([lead(), lead({ latitude: -31.95, longitude: 115.86 })])).toBe(1)
  })

  it('keeps unsynced IndexedDB edits but lets shared updates refresh a synced pin', () => {
    const localPin = { id: 'pin-1', latitude: -32, longitude: 116, outcome: PinOutcome.Knocked, synced: false } as Pin
    const sharedLead = lead({ pinId: 'pin-1', latitude: -31.95, longitude: 115.86 })
    expect(mergeLeadMapPins([localPin], [sharedLead])).toEqual([localPin])

    const syncedPin = { ...localPin, synced: true }
    expect(mergeLeadMapPins([syncedPin], [sharedLead])[0]).toMatchObject({ latitude: -31.95, longitude: 115.86 })
  })

  it('preserves unsynced IndexedDB pins when merging the remote pin snapshot', () => {
    const localPin = { id: 'pin-1', latitude: -32, longitude: 116, outcome: PinOutcome.Knocked, linkedLeadId: 'lead-1', synced: false, syncAttempts: 1 } as Pin
    const remotePin = { ...localPin, latitude: -31.95, longitude: 115.86, outcome: PinOutcome.NotKnocked, linkedLeadId: 'stale-lead-id', synced: true, syncAttempts: 0 }
    const newRemotePin = { ...remotePin, id: 'pin-2' }

    expect(mergeCachedAndRemotePins([localPin], [remotePin, newRemotePin])).toEqual([
      localPin,
      { ...newRemotePin, synced: true, syncAttempts: 0 },
    ])
  })
})
