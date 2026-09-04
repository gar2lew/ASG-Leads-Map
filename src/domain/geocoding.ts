export type AddressConfidence = 'direct' | 'nearby_high' | 'nearby_suggested' | 'manual'

export type AddressSource = 'direct_reverse' | 'nearby_osm' | 'manual'

export interface GeocodingComponents {
  houseNumber?: string | undefined
  road?: string | undefined
  pedestrian?: string | undefined
  residential?: string | undefined
  highway?: string | undefined
  footway?: string | undefined
  suburb?: string | undefined
  city?: string | undefined
  town?: string | undefined
  village?: string | undefined
  state?: string | undefined
  postcode?: string | undefined
  country?: string | undefined
}

export interface AddressedPropertyCandidate {
  houseNumber: string
  street?: string | undefined
  unit?: string | undefined
  latitude: number
  longitude: number
  distanceMetres: number
  sameStreet: boolean
}

export interface GeocodingResult {
  address: string
  components?: GeocodingComponents
  houseNumber?: string | undefined
  street?: string | undefined
  suburb?: string | undefined
  state?: string | undefined
  postcode?: string | undefined
  latitude: number
  longitude: number
  source: AddressSource
  confidence: AddressConfidence
  nearbyDistance?: number | undefined
  raw?: any
}

export interface GeocodingError {
  message: string
  code?: string
}

export const NEARBY_SEARCH_RADIUS_METRES = 25
export const NEARBY_HIGH_MAX_METRES = 10
export const NEARBY_SUGGESTED_MAX_METRES = 25

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/reverse'
const OVERPASS_BASE_URL = 'https://overpass-api.de/api/interpreter'
const USER_AGENT = 'ASG-Leads-Map/1.0 (asg-leads-map)'

const STATE_ABBREVIATIONS: Record<string, string> = {
  'new south wales': 'NSW',
  'victoria': 'VIC',
  'queensland': 'QLD',
  'south australia': 'SA',
  'western australia': 'WA',
  'tasmania': 'TAS',
  'australian capital territory': 'ACT',
  'northern territory': 'NT',
}

const STREET_TYPE_ABBREVIATIONS: Record<string, string> = {
  st: 'street',
  rd: 'road',
  ave: 'avenue',
  blvd: 'boulevard',
  dr: 'drive',
  pl: 'place',
  ct: 'court',
  ter: 'terrace',
  cres: 'crescent',
  ln: 'lane',
  hwy: 'highway',
  pde: 'parade',
  cl: 'close',
  grv: 'grove',
  rte: 'route',
  mwy: 'motorway',
  cct: 'circuit',
  cnr: 'corner',
}

export interface HouseNumberFallbackParts {
  street: string
  locality: string
}

export function canCompleteManualHouseNumber(components: GeocodingComponents | undefined): boolean {
  if (!components) return false
  if (isUsableHouseNumber(components.houseNumber)) return false
  const road = formatRoadName(components)
  const locality = components.suburb || components.city
  return Boolean(road && locality && components.state && components.postcode)
}

export function houseNumberFallbackParts(
  components: GeocodingComponents | undefined
): HouseNumberFallbackParts | null {
  if (!components) return null
  const street = formatRoadName(components)
  const locality = [components.suburb || components.city, abbreviateAustralianState(components.state), components.postcode]
    .filter(Boolean)
    .join(' ')
  if (!street || !locality) return null
  return { street, locality }
}

export function composeAustralianAddress(
  houseNumber: string,
  components: GeocodingComponents | undefined
): string {
  const value = houseNumber.trim()
  return formatAustralianAddress({
    ...(components ?? {}),
    houseNumber: value || undefined,
  })
}

export function abbreviateAustralianState(state: string | undefined): string | undefined {
  if (!state) return undefined
  const trimmed = state.trim()
  if (!trimmed) return undefined
  if (/^[A-Z]{2,3}$/.test(trimmed)) return trimmed
  const key = trimmed.toLowerCase().replace(/\s+/g, ' ')
  return STATE_ABBREVIATIONS[key] ?? trimmed
}

export function haversineDistanceMetres(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

function isUsableHouseNumber(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  const trimmed = String(value).trim()
  if (!trimmed) return undefined
  if (/^(s\/?n|unnumbered|none|-)$/i.test(trimmed)) return undefined
  return trimmed
}

function formatRoadName(address: GeocodingComponents): string | undefined {
  return (
    address.road ??
    address.pedestrian ??
    address.residential ??
    address.highway ??
    address.footway ??
    undefined
  )
}

function extractComponents(addr: Record<string, unknown>): GeocodingComponents {
  return {
    houseNumber: isUsableHouseNumber(addr['house_number']),
    road: typeof addr['road'] === 'string' && addr['road'] ? addr['road'] : undefined,
    pedestrian: typeof addr['pedestrian'] === 'string' && addr['pedestrian'] ? addr['pedestrian'] : undefined,
    residential: typeof addr['residential'] === 'string' && addr['residential'] ? addr['residential'] : undefined,
    highway: typeof addr['highway'] === 'string' && addr['highway'] ? addr['highway'] : undefined,
    footway: typeof addr['footway'] === 'string' && addr['footway'] ? addr['footway'] : undefined,
    suburb:
      (typeof addr['suburb'] === 'string' && addr['suburb'] ? addr['suburb'] : undefined) ??
      (typeof addr['neighbourhood'] === 'string' && addr['neighbourhood'] ? addr['neighbourhood'] : undefined),
    city:
      (typeof addr['city'] === 'string' && addr['city'] ? addr['city'] : undefined) ??
      (typeof addr['town'] === 'string' && addr['town'] ? addr['town'] : undefined) ??
      (typeof addr['village'] === 'string' && addr['village'] ? addr['village'] : undefined),
    state: typeof addr['state'] === 'string' && addr['state'] ? addr['state'] : undefined,
    postcode: typeof addr['postcode'] === 'string' && addr['postcode'] ? addr['postcode'] : undefined,
    country: typeof addr['country'] === 'string' && addr['country'] ? addr['country'] : undefined,
  }
}

function formatAustralianAddress(components: GeocodingComponents | undefined): string {
  if (!components) return ''

  const parts: string[] = []
  const road = formatRoadName(components)

  if (components.houseNumber && road) {
    parts.push(`${components.houseNumber} ${road}`)
  } else if (road) {
    parts.push(road)
  }

  const locality = components.suburb || components.city
  if (locality) {
    parts.push(locality)
  }

  const state = abbreviateAustralianState(components.state)
  if (state) {
    parts.push(state)
  }

  if (components.postcode) {
    parts.push(components.postcode)
  }

  return parts.join(', ')
}

async function fetchNominatimReverse(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<any> {
  const params = new URLSearchParams({
    lat: latitude.toString(),
    lon: longitude.toString(),
    format: 'json',
    addressdetails: '1',
    extratags: '0',
    namedetails: '0',
    'accept-language': 'en-AU,en;q=0.9',
  })

  const response = await fetch(`${NOMINATIM_BASE_URL}?${params}`, {
    headers: {
      'User-Agent': USER_AGENT,
    },
    signal: signal ?? null,
  })

  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (!data.address) {
    throw new Error('No address found for this location')
  }

  return data
}

function normaliseStreetName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\b(st|rd|ave|blvd|dr|pl|ct|ter|cres|ln|hwy|pde|cl|grv|rte|mwy|cct|cnr)\b/g, (m) => STREET_TYPE_ABBREVIATIONS[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

function streetsMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return normaliseStreetName(a) === normaliseStreetName(b)
}

async function fetchOverpass(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<any> {
  const query = [
    '[out:json][timeout:15];',
    `nwr(around:${NEARBY_SEARCH_RADIUS_METRES},${latitude.toFixed(6)},${longitude.toFixed(6)})["addr:housenumber"];`,
    'out tags center;',
  ].join('')

  const params = new URLSearchParams({ data: query })

  const response = await fetch(`${OVERPASS_BASE_URL}?${params}`, {
    headers: {
      'User-Agent': USER_AGENT,
    },
    signal: signal ?? null,
  })

  if (!response.ok) {
    throw new Error(`Nearby property lookup failed: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

function parseOverpassElement(
  element: any,
  latitude: number,
  longitude: number,
  referenceStreet?: string
): AddressedPropertyCandidate | null {
  const houseNumber = isUsableHouseNumber(element?.tags?.['addr:housenumber'])
  if (!houseNumber) return null

  const elementLat = element.type === 'node' ? element.lat : element?.center?.lat
  const elementLon = element.type === 'node' ? element.lon : element?.center?.lon
  if (typeof elementLat !== 'number' || typeof elementLon !== 'number') return null

  const distance = haversineDistanceMetres(latitude, longitude, elementLat, elementLon)
  if (distance > NEARBY_SUGGESTED_MAX_METRES) return null

  const street =
    typeof element?.tags?.['addr:street'] === 'string' && element.tags['addr:street']
      ? element.tags['addr:street']
      : undefined

  return {
    houseNumber,
    street,
    unit: typeof element?.tags?.['addr:unit'] === 'string' ? element.tags['addr:unit'] : undefined,
    latitude: elementLat,
    longitude: elementLon,
    distanceMetres: Math.round(distance * 10) / 10,
    sameStreet: streetsMatch(street, referenceStreet),
  }
}

function selectBestCandidate(
  candidates: AddressedPropertyCandidate[],
  referenceStreet?: string
): AddressedPropertyCandidate | null {
  if (candidates.length === 0) return null

  const sameStreet = referenceStreet ? candidates.filter((c) => c.sameStreet) : []
  const pool = sameStreet.length > 0 ? sameStreet : candidates

  pool.sort((a, b) => a.distanceMetres - b.distanceMetres)
  return pool[0] ?? null
}

/**
 * Find the nearest plausible addressed property to the given coordinates.
 *
 * Queries Overpass for nodes/ways/relations carrying an `addr:housenumber`
 * tag within a small radius. When `referenceStreet` is provided (typically the
 * road resolved by the initial reverse geocode), candidates on that street are
 * preferred over marginally closer candidates on a different street.
 *
 * Returns `null` when no acceptable candidate exists (no data, or every
 * candidate is beyond the acceptable distance).
 */
export async function findNearestAddressedProperty(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
  referenceStreet?: string
): Promise<AddressedPropertyCandidate | null> {
  const data = await fetchOverpass(latitude, longitude, signal)
  const elements = Array.isArray(data?.elements) ? data.elements : []

  const candidates: AddressedPropertyCandidate[] = []
  for (const element of elements) {
    const candidate = parseOverpassElement(element, latitude, longitude, referenceStreet)
    if (candidate) candidates.push(candidate)
  }

  return selectBestCandidate(candidates, referenceStreet)
}

function manualFallbackResult(
  data: any,
  components: GeocodingComponents,
  latitude: number,
  longitude: number,
  address: string
): GeocodingResult {
  return {
    address,
    components,
    street: formatRoadName(components),
    suburb: components.suburb ?? components.city,
    state: components.state,
    postcode: components.postcode,
    latitude,
    longitude,
    source: 'manual',
    confidence: 'manual',
    raw: data,
  }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  signal?: AbortSignal
): Promise<GeocodingResult> {
  const data = await fetchNominatimReverse(latitude, longitude, signal)
  const components = extractComponents(data.address)

  const formattedAddress = formatAustralianAddress(components)
  if (!formattedAddress) {
    throw new Error('Could not determine a usable address')
  }

  const baseStreet = formatRoadName(components)

  if (components.houseNumber) {
    return {
      address: formattedAddress,
      components,
      houseNumber: components.houseNumber,
      street: baseStreet,
      suburb: components.suburb ?? components.city,
      state: components.state,
      postcode: components.postcode,
      latitude,
      longitude,
      source: 'direct_reverse',
      confidence: 'direct',
      raw: data,
    }
  }

  let candidate: AddressedPropertyCandidate | null = null
  try {
    candidate = await findNearestAddressedProperty(latitude, longitude, signal, baseStreet)
  } catch (error) {
    console.warn('Nearby property lookup failed; continuing with street-level address:', error)
  }

  if (!candidate) {
    return manualFallbackResult(data, components, latitude, longitude, formattedAddress)
  }

  const mergedComponents: GeocodingComponents = {
    ...components,
    houseNumber: candidate.houseNumber,
    road: candidate.street ?? baseStreet,
  }
  const candidateAddress = formatAustralianAddress(mergedComponents)

  const confidence: AddressConfidence =
    candidate.distanceMetres <= NEARBY_HIGH_MAX_METRES ? 'nearby_high' : 'nearby_suggested'

  return {
    address: candidateAddress,
    components: mergedComponents,
    houseNumber: candidate.houseNumber,
    street: candidate.street ?? baseStreet,
    suburb: components.suburb ?? components.city,
    state: components.state,
    postcode: components.postcode,
    latitude,
    longitude,
    source: 'nearby_osm',
    confidence,
    nearbyDistance: candidate.distanceMetres,
    raw: data,
  }
}

export function isGeocodingError(error: unknown): error is GeocodingError {
  return error instanceof Error
}