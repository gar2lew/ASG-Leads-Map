import { PinOutcome } from './pinOutcome'
import type { LeadRecord } from './leadRegister'
import type { Pin } from './pin'

export function leadToMapPin(lead: LeadRecord): Pin | null {
  if (!Number.isFinite(lead.latitude) || !Number.isFinite(lead.longitude)) return null
  return {
    id: lead.pinId || lead.id,
    linkedLeadId: lead.id,
    latitude: lead.latitude as number,
    longitude: lead.longitude as number,
    outcome: lead.pinOutcome || PinOutcome.Lead,
    address: lead.address || undefined,
    notes: lead.notes || undefined,
    contactName: lead.leadName || undefined,
    contactPhone: lead.phone || undefined,
    contactEmail: undefined,
    createdAt: lead.date,
    updatedAt: lead.lastActivityAt || lead.callTimestamp,
    createdBy: lead.repName || '',
    ...(lead.office ? { officeId: lead.office } : {}),
    synced: true,
    syncAttempts: 0,
  }
}

/** Existing/offline pins win when a shared lead references the same marker. */
export function mergeLeadMapPins(localPins: Pin[], leads: LeadRecord[]): Pin[] {
  const pins = new Map(localPins.map((pin) => [pin.id, pin]))
  for (const lead of leads) {
    const pin = leadToMapPin(lead)
    const localPin = pin ? pins.get(pin.id) : undefined
    if (pin && (!localPin || localPin.synced)) pins.set(pin.id, pin)
  }
  return [...pins.values()]
}

/** Remote snapshots refresh clean cache entries but never overwrite queued offline edits. */
export function mergeCachedAndRemotePins(localPins: Pin[], remotePins: Pin[]): Pin[] {
  const pins = new Map(localPins.map((pin) => [pin.id, pin]))
  for (const remotePin of remotePins) {
    const localPin = pins.get(remotePin.id)
    if (!localPin || localPin.synced !== false) {
      pins.set(remotePin.id, { ...remotePin, synced: true, syncAttempts: 0 })
    }
  }
  return [...pins.values()]
}

export function countLeadsNeedingLocation(leads: LeadRecord[]): number {
  return leads.filter((lead) => !Number.isFinite(lead.latitude) || !Number.isFinite(lead.longitude)).length
}
