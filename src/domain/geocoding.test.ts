import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  reverseGeocode,
  findNearestAddressedProperty,
  haversineDistanceMetres,
  abbreviateAustralianState,
  NEARBY_HIGH_MAX_METRES,
  NEARBY_SUGGESTED_MAX_METRES,
} from './geocoding'

const DROP_LAT = -31.9505
const DROP_LON = 115.8605
const METRES_PER_DEGREE_LAT = 111320

let overpassCalls = 0
let overpassElements: any[] = []
let overpassFails = false

function latAt(distanceMetres: number): number {
  return DROP_LAT + distanceMetres / METRES_PER_DEGREE_LAT
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function nominatimBody(overrides: Record<string, unknown> = {}): any {
  return {
    place_id: 1001,
    lat: String(DROP_LAT),
    lon: String(DROP_LON),
    display_name: 'Melba Place, Westminster, WA 6061',
    address: {
      house_number: '17',
      road: 'Melba Place',
      suburb: 'Westminster',
      state: 'Western Australia',
      postcode: '6061',
      country: 'Australia',
      country_code: 'au',
      ...overrides,
    },
  }
}

function overpassElement(
  id: number,
  lat: number,
  tags: Record<string, string>
): any {
  return { type: 'node', id, lat, lon: DROP_LON, tags }
}

function setupFetch(
  nominatimBodyFn: () => any = nominatimBody,
  init?: { abortBehaviour?: 'ignore' }
) {
  const fetchMock = vi.fn(async (url: RequestInfo | URL, reqInit?: RequestInit) => {
    if (init?.abortBehaviour === 'ignore' && reqInit?.signal?.aborted) {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' })
    }
    const href = String(url)
    if (href.includes('nominatim.openstreetmap.org/reverse')) {
      return jsonResponse(nominatimBodyFn())
    }
    if (href.includes('overpass-api.de/api/interpreter')) {
      overpassCalls++
      if (overpassFails) return jsonResponse({ remark: 'timeout' }, 503)
      return jsonResponse({ elements: overpassElements })
    }
    throw new Error(`Unexpected fetch: ${href}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  overpassCalls = 0
  overpassElements = []
  overpassFails = false
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('reverseGeocode - direct house number', () => {
  it('returns a concise Australian address for a direct Nominatim result with a house number', async () => {
    setupFetch()

    const result = await reverseGeocode(DROP_LAT, DROP_LON)

    expect(result.address).toBe('17 Melba Place, Westminster, WA, 6061')
    expect(result.houseNumber).toBe('17')
    expect(result.street).toBe('Melba Place')
    expect(result.suburb).toBe('Westminster')
    expect(result.state).toBe('Western Australia')
    expect(result.postcode).toBe('6061')
    expect(result.confidence).toBe('direct')
    expect(result.source).toBe('direct_reverse')
  })

  it('formats number + street + suburb + state + postcode and abbreviates the state', async () => {
    setupFetch()

    const result = await reverseGeocode(DROP_LAT, DROP_LON)

    expect(result.address).toMatch(/^17 Melba Place, Westminster, WA, 6061$/)
    expect(result.address).not.toContain('Western Australia')
  })

  it('does not run the nearby lookup when Nominatim already returned a house number', async () => {
    setupFetch()

    await reverseGeocode(DROP_LAT, DROP_LON)

    expect(overpassCalls).toBe(0)
  })

  it('uses pedestrian streets when Nominatim has no road field', async () => {
    setupFetch(() => nominatimBody({ house_number: '3', road: undefined, pedestrian: 'Woolworths Walk', suburb: 'Westminster', state: 'WA', postcode: '6061' }))

    const result = await reverseGeocode(DROP_LAT, DROP_LON)

    expect(result.address).toBe('3 Woolworths Walk, Westminster, WA, 6061')
    expect(result.source).toBe('direct_reverse')
  })

  it('falls back to town when no suburb or city is present', async () => {
    setupFetch(() => nominatimBody({ house_number: '12', suburb: undefined, city: undefined, town: 'Geraldton', state: 'WA', postcode: '6530' }))

    const result = await reverseGeocode(DROP_LAT, DROP_LON)

    expect(result.address).toBe('12 Melba Place, Geraldton, WA, 6530')
  })
})

describe('reverseGeocode - nearby fallback', () => {
  it('runs the nearby lookup when the Nominatim result has no house number', async () => {
    setupFetch(() => nominatimBody({ house_number: undefined }))
    overpassElements = [overpassElement(1, latAt(6), { 'addr:housenumber': '17', 'addr:street': 'Melba Place' })]

    const result = await reverseGeocode(DROP_LAT, DROP_LON)

    expect(overpassCalls).toBe(1)
    expect(result.houseNumber).toBe('17')
    expect(result.address).toBe('17 Melba Place, Westminster, WA, 6061')
    expect(result.source).toBe('nearby_osm')
  })

  it('chooses the nearest candidate on the same street', async () => {
    setupFetch(() => nominatimBody({ house_number: undefined }))
    overpassElements = [
      overpassElement(1, latAt(21), { 'addr:housenumber': '19', 'addr:street': 'Melba Place' }),
      overpassElement(2, latAt(6), { 'addr:housenumber': '17', 'addr:street': 'Melba Place' }),
    ]

    const result = await reverseGeocode(DROP_LAT, DROP_LON)

    expect(result.houseNumber).toBe('17')
    expect(result.address).toBe('17 Melba Place, Westminster, WA, 6061')
  })

  it('prefers a same-street candidate over a marginally closer different-street candidate', async () => {
    setupFetch(() => nominatimBody({ house_number: undefined, road: 'Melba Place' }))
    overpassElements = [
      overpassElement(1, latAt(8), { 'addr:housenumber': '24', 'addr:street': 'Arkana Road' }),
      overpassElement(2, latAt(12), { 'addr:housenumber': '17', 'addr:street': 'Melba Place' }),
    ]

    const result = await reverseGeocode(DROP_LAT, DROP_LON)

    expect(result.houseNumber).toBe('17')
    expect(result.address).toBe('17 Melba Place, Westminster, WA, 6061')
    expect(result.nearbyDistance).toBe(12)
  })

  it('classifies a candidate within 10m as nearby_high', async () => {
    setupFetch(() => nominatimBody({ house_number: undefined }))
    overpassElements = [overpassElement(1, latAt(6), { 'addr:housenumber': '17', 'addr:street': 'Melba Place' })]

    const result = await reverseGeocode(DROP_LAT, DROP_LON)

    expect(result.confidence).toBe('nearby_high')
    expect(result.nearbyDistance).toBeLessThanOrEqual(NEARBY_HIGH_MAX_METRES)
  })

  it('classifies a candidate between 10-25m as nearby_suggested', async () => {
    setupFetch(() => nominatimBody({ house_number: undefined }))
    overpassElements = [overpassElement(1, latAt(21), { 'addr:housenumber': '17', 'addr:street': 'Melba Place' })]

    const result = await reverseGeocode(DROP_LAT, DROP_LON)

    expect(result.confidence).toBe('nearby_suggested')
    expect(result.nearbyDistance).toBeGreaterThan(NEARBY_HIGH_MAX_METRES)
    expect(result.nearbyDistance).toBeLessThanOrEqual(NEARBY_SUGGESTED_MAX_METRES)
  })

  it('does not auto-assign a house number when the nearest candidate is beyond 25m', async () => {
    setupFetch(() => nominatimBody({ house_number: undefined }))
    overpassElements = [overpassElement(1, latAt(30), { 'addr:housenumber': '17', 'addr:street': 'Melba Place' })]

    const result = await reverseGeocode(DROP_LAT, DROP_LON)

    expect(result.houseNumber).toBeUndefined()
    expect(result.confidence).toBe('manual')
    expect(result.source).toBe('manual')
    expect(result.address).toBe('Melba Place, Westminster, WA, 6061')
    expect(NEARBY_SUGGESTED_MAX_METRES).toBe(25)
  })

  it('falls back to the street-level address when no nearby candidates exist', async () => {
    setupFetch(() => nominatimBody({ house_number: undefined }))
    overpassElements = []

    const result = await reverseGeocode(DROP_LAT, DROP_LON)

    expect(result.address).toBe('Melba Place, Westminster, WA, 6061')
    expect(result.houseNumber).toBeUndefined()
    expect(result.confidence).toBe('manual')
  })

  it('falls back safely when the nearby lookup fails', async () => {
    setupFetch(() => nominatimBody({ house_number: undefined }))
    overpassFails = true

    const result = await reverseGeocode(DROP_LAT, DROP_LON)

    expect(result.address).toBe('Melba Place, Westminster, WA, 6061')
    expect(result.houseNumber).toBeUndefined()
    expect(result.confidence).toBe('manual')
    expect(result.source).toBe('manual')
  })

  it('ignores candidates that only describe a road or suburb without a house number', async () => {
    setupFetch(() => nominatimBody({ house_number: undefined }))
    overpassElements = [
      overpassElement(1, latAt(5), { 'addr:street': 'Melba Place', highway: 'residential' }),
      overpassElement(2, latAt(6), { 'addr:suburb': 'Westminster' }),
    ]

    const result = await reverseGeocode(DROP_LAT, DROP_LON)
    expect(result.houseNumber).toBeUndefined()
    expect(result.confidence).toBe('manual')
  })
})

describe('reverseGeocode - staleness and abort protection', () => {
  it('rejects with AbortError and does not run the nearby lookup when aborted', async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, reqInit?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        reqInit?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
        )
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const controller = new AbortController()
    const pending = reverseGeocode(DROP_LAT, DROP_LON, controller.signal)

    controller.abort()

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('findNearestAddressedProperty', () => {
  it('returns null when no acceptable addressed property exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ elements: [] }))
    )

    await expect(findNearestAddressedProperty(DROP_LAT, DROP_LON)).resolves.toBeNull()
  })

  it('returns the nearest addressed property within the search radius', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          elements: [
            { type: 'way', id: 1, center: { lat: latAt(9), lon: DROP_LON }, tags: { 'addr:housenumber': '17', 'addr:street': 'Melba Place' } },
            { type: 'node', id: 2, lat: latAt(4), lon: DROP_LON, tags: { 'addr:housenumber': '15', 'addr:street': 'Melba Place' } },
          ],
        })
      )
    )

    const candidate = await findNearestAddressedProperty(DROP_LAT, DROP_LON)

    expect(candidate).not.toBeNull()
    expect(candidate!.houseNumber).toBe('15')
    expect(candidate!.distanceMetres).toBeLessThanOrEqual(NEARBY_HIGH_MAX_METRES)
  })

  it('matches street names with common abbreviations', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          elements: [
            { type: 'node', id: 1, lat: latAt(6), lon: DROP_LON, tags: { 'addr:housenumber': '17', 'addr:street': 'Melba Pl.' } },
          ],
        })
      )
    )

    const candidate = await findNearestAddressedProperty(DROP_LAT, DROP_LON, undefined, 'Melba Place')

    expect(candidate?.sameStreet).toBe(true)
  })
})

describe('helpers', () => {
  it('abbreviates all Australian state names', () => {
    expect(abbreviateAustralianState('Western Australia')).toBe('WA')
    expect(abbreviateAustralianState('New South Wales')).toBe('NSW')
    expect(abbreviateAustralianState('Queensland')).toBe('QLD')
    expect(abbreviateAustralianState('Victoria')).toBe('VIC')
    expect(abbreviateAustralianState('South Australia')).toBe('SA')
    expect(abbreviateAustralianState('Tasmania')).toBe('TAS')
    expect(abbreviateAustralianState('Australian Capital Territory')).toBe('ACT')
    expect(abbreviateAustralianState('Northern Territory')).toBe('NT')
  })

  it('leaves already-abbreviated states untouched and handles missing values', () => {
    expect(abbreviateAustralianState('WA')).toBe('WA')
    expect(abbreviateAustralianState('')).toBeUndefined()
    expect(abbreviateAustralianState(undefined)).toBeUndefined()
    expect(abbreviateAustralianState('Somewhere Else')).toBe('Somewhere Else')
  })

  it('calculates haversine distances in metres', () => {
    expect(haversineDistanceMetres(DROP_LAT, DROP_LON, latAt(6), DROP_LON)).toBeCloseTo(6, 1)
    expect(haversineDistanceMetres(DROP_LAT, DROP_LON, DROP_LAT, DROP_LON)).toBe(0)
  })
})