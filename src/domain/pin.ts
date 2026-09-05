import { PinOutcome } from './pinOutcome'
import type { OfficeId } from './roles'

export interface Pin {
  id: string
  latitude: number
  longitude: number
  outcome: PinOutcome
  address: string | undefined
  notes: string | undefined
  contactName: string | undefined
  contactPhone: string | undefined
  contactEmail: string | undefined
  createdAt: string
  updatedAt: string
  createdBy: string
  officeId?: OfficeId
  synced: boolean
  syncAttempts: number
}

export interface CreatePinInput {
  latitude: number
  longitude: number
  outcome: PinOutcome | undefined
  address: string | undefined
  notes: string | undefined
  contactName: string | undefined
  contactPhone: string | undefined
  contactEmail: string | undefined
  officeId?: OfficeId
}

export interface UpdatePinInput {
  id: string
  outcome: PinOutcome | undefined
  address: string | undefined
  notes: string | undefined
  contactName: string | undefined
  contactPhone: string | undefined
  contactEmail: string | undefined
}

export interface PinFilters {
  outcome: PinOutcome | undefined
  repId: string | undefined
  dateFrom: string | undefined
  dateTo: string | undefined
  bounds: {
    north: number
    south: number
    east: number
    west: number
  } | undefined
}

export const DEFAULT_PIN_OUTCOME = PinOutcome.NotKnocked

export function createPin(input: CreatePinInput, userId: string, officeId?: OfficeId): Pin {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    latitude: input.latitude,
    longitude: input.longitude,
    outcome: input.outcome ?? DEFAULT_PIN_OUTCOME,
    address: input.address,
    notes: input.notes,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    contactEmail: input.contactEmail,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    ...(officeId ? { officeId } : {}),
    synced: false,
    syncAttempts: 0,
  }
}

export function updatePin(pin: Pin, input: UpdatePinInput): Pin {
  return {
    ...pin,
    ...input,
    outcome: input.outcome ?? pin.outcome,
    updatedAt: new Date().toISOString(),
    synced: false,
  }
}

// Simple GeoJSON types to avoid external dependency
interface GeoJSONPoint {
  type: 'Point'
  coordinates: [number, number]
}

interface GeoJSONFeatureProperties {
  id: string
  outcome: PinOutcome
  address: string | undefined
  notes: string | undefined
  contactName: string | undefined
  contactPhone: string | undefined
  contactEmail: string | undefined
  createdAt: string
  updatedAt: string
}

export interface GeoJSONFeature {
  type: 'Feature'
  geometry: GeoJSONPoint
  properties: GeoJSONFeatureProperties
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection'
  features: GeoJSONFeature[]
}

export function pinToGeoJSON(pin: Pin): GeoJSONFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [pin.longitude, pin.latitude],
    },
    properties: {
      id: pin.id,
      outcome: pin.outcome,
      address: pin.address,
      notes: pin.notes,
      contactName: pin.contactName,
      contactPhone: pin.contactPhone,
      contactEmail: pin.contactEmail,
      createdAt: pin.createdAt,
      updatedAt: pin.updatedAt,
    },
  }
}

export function pinsToGeoJSON(pins: Pin[]): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pins.map(pinToGeoJSON),
  }
}
