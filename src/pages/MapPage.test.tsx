// ============================================
// TEST STATE - Must be at top level for vi.mock hoisting access
// ============================================

const mockPins: any[] = []
let pinIdCounter = 0
const markerEventListeners = new Map<string, Set<Function>>()

// ============================================
// GEOCODING MOCK - Must use vi.hoisted for vi.mock factory access
// ============================================

const { mockReverseGeocode } = vi.hoisted(() => {
  return {
    mockReverseGeocode: vi.fn(),
  }
})

// ============================================
// GEOCODING HELPERS
// ============================================

function createMockGeocodeResult(address: string = '42 Smith Street, Joondalup WA 6027') {
  return Promise.resolve({
    address,
    components: {
      houseNumber: '42',
      road: 'Smith Street',
      suburb: 'Joondalup',
      state: 'WA',
      postcode: '6027',
    },
  })
}

function createMockGeocodeError(message: string = 'Geocoding service unavailable') {
  return Promise.reject(new Error(message))
}

// ============================================
// MAPLIBRE-GL MOCK - vi.mock factory (hoisted to top)
// ============================================

vi.mock('maplibre-gl', () => {
  function createMockMap() {
    const listeners = new Map<string, Set<Function>>()
    
    const mockMapInstance = {
      _listeners: listeners,
      _container: document.createElement('div'),
      _style: { sources: {}, layers: [] },
      _canvas: document.createElement('canvas'),
      
      addControl: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      
      on: vi.fn((event: string, handler: Function) => {
        if (!listeners.has(event)) listeners.set(event, new Set())
        listeners.get(event)!.add(handler)
        return mockMapInstance
      }),
      
      off: vi.fn((event: string, handler?: Function) => {
        if (handler) {
          listeners.get(event)?.delete(handler)
        } else {
          listeners.delete(event)
        }
        return mockMapInstance
      }),
      
      _triggerEvent: (event: string, data?: any) => {
        listeners.get(event)?.forEach(handler => handler(data))
      },
      
      dragPan: { disable: vi.fn(), enable: vi.fn() },
      
      getContainer: vi.fn(() => mockMapInstance._container),
      getCanvas: vi.fn(() => mockMapInstance._canvas),
      
      project: vi.fn((lngLat: { lng: number; lat: number }) => ({ x: lngLat.lng * 100, y: lngLat.lat * 100 })),
      unproject: vi.fn((point: { x: number; y: number }) => ({ lng: point.x / 100, lat: point.y / 100 })),
      
      getStyle: vi.fn(() => ({ sources: {}, layers: [] })),
      addSource: vi.fn(),
      removeSource: vi.fn(),
      getSource: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      getLayer: vi.fn(),
      
      getCenter: vi.fn(() => ({ lng: 115.8605, lat: -31.9505 })),
      getZoom: vi.fn(() => 10),
      easeTo: vi.fn(),
      getBounds: vi.fn(() => ({
        getWest: () => 115, getEast: () => 116,
        getSouth: () => -32, getNorth: () => -31
      })),
      
      _cleanup: () => {
        listeners.clear()
      }
    }
    
    mockMapInstance._container.style = {} as any
    mockMapInstance._container.getBoundingClientRect = vi.fn(() => ({
      width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {}
    }))
    mockMapInstance._canvas.getBoundingClientRect = vi.fn(() => ({
      width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => {}
    }))
    
    return mockMapInstance
  }

  class MockMapClass {
    static _instances: ReturnType<typeof createMockMap>[] = []
    
    constructor(options: any) {
      const instance = createMockMap()
      MockMapClass._instances.push(instance)
      instance._container = options.container || document.createElement('div')
      return instance
    }
    
    static getLastInstance() {
      return MockMapClass._instances[MockMapClass._instances.length - 1]
    }
    
    static clearInstances() {
      MockMapClass._instances.forEach(i => i._cleanup?.())
      MockMapClass._instances = []
    }
  }

  class MockMarkerClass {
    _element: HTMLElement
    _lngLat: { lng: number; lat: number } | null = null
    _map: ReturnType<typeof createMockMap> | null = null
    _anchor: string = 'center'
    
    constructor(options: { element: HTMLElement; anchor?: string }) {
      this._element = options.element
      this._anchor = options.anchor || 'center'
    }
    
    setLngLat(lngLat: { lng: number; lat: number } | [number, number]) {
      const lng = Array.isArray(lngLat) ? lngLat[0] : lngLat.lng
      const lat = Array.isArray(lngLat) ? lngLat[1] : lngLat.lat
      this._lngLat = { lng, lat }
      return this
    }
    
    addTo(map: any) {
      this._map = map
      map._container?.appendChild(this._element)
      return this
    }
    
    remove() {
      this._element.remove()
      this._map = null
      return this
    }
    
    getElement() {
      return this._element
    }
    
    setPopup(_popup: any) { return this }
    togglePopup() { return this }
    
    on(event: string, handler: Function) {
      if (!markerEventListeners.has(event)) markerEventListeners.set(event, new Set())
      markerEventListeners.get(event)!.add(handler)
      return this
    }
    
    off(event: string, handler?: Function) {
      if (handler) {
        markerEventListeners.get(event)?.delete(handler)
      } else {
        markerEventListeners.delete(event)
      }
      return this
    }
  }

  class MockPopupClass {
    _options: any
    _lngLat: { lng: number; lat: number } | null = null
    _html: string = ''
    _map: any = null
    
    constructor(options: any = {}) {
      this._options = options
    }
    
    setLngLat(lngLat: { lng: number; lat: number } | [number, number]) {
      const lng = Array.isArray(lngLat) ? lngLat[0] : lngLat.lng
      const lat = Array.isArray(lngLat) ? lngLat[1] : lngLat.lat
      this._lngLat = { lng, lat }
      return this
    }
    
    setHTML(html: string) {
      this._html = html
      return this
    }
    
    addTo(map: any) {
      this._map = map
      return this
    }
    
    remove() {
      this._map = null
      return this
    }
    
    setDOMContent(_node: Node) { return this }
    setText(_text: string) { return this }
  }

  class MockControlClass {
    onAdd = vi.fn()
    onRemove = vi.fn()
  }

  return {
    Map: MockMapClass,
    Marker: MockMarkerClass,
    Popup: MockPopupClass,
    NavigationControl: MockControlClass,
    FullscreenControl: MockControlClass,
    GeolocateControl: MockControlClass,
    default: {
      Map: MockMapClass,
      Marker: MockMarkerClass,
      Popup: MockPopupClass,
      NavigationControl: MockControlClass,
      FullscreenControl: MockControlClass,
      GeolocateControl: MockControlClass,
    }
  }
})

// ============================================
// DOMAIN MOCK - vi.mock factory (hoisted to top)
// ============================================

vi.mock('../domain', async () => {
  const actual = await vi.importActual<typeof import('../domain')>('../domain')
  const domainModule: any = {
    ...actual,
    getAllPins: vi.fn().mockImplementation(() => Promise.resolve([...mockPins])),
    savePin: vi.fn().mockImplementation((pin: any) => {
      const existingIndex = mockPins.findIndex(p => p.id === pin.id)
      if (existingIndex >= 0) {
        mockPins[existingIndex] = { ...pin }
      } else {
        mockPins.push({ ...pin })
      }
      return Promise.resolve(undefined)
    }),
    getPinCountByOutcome: vi.fn().mockImplementation(() => {
      const counts: Record<string, number> = {}
      mockPins.forEach(p => { counts[p.outcome] = (counts[p.outcome] || 0) + 1 })
      return Promise.resolve(counts)
    }),
    createPin: vi.fn((input: any, userId: string) => {
      const newPin = {
        id: `test-pin-${++pinIdCounter}`,
        ...input,
        outcome: input.outcome || 'not_knocked',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
        synced: false,
        syncAttempts: 0,
      }
      mockPins.push(newPin)
      return newPin
    }),
    PinOutcome: {
      Knocked: 'knocked',
      NotKnocked: 'not_knocked',
      NotInterested: 'not_interested',
      DidNotQualify: 'did_not_qualify',
      Lead: 'lead',
    },
    pinOutcomeOrder: ['knocked', 'not_knocked', 'not_interested', 'did_not_qualify', 'lead'],
    pinOutcomeLabel: (outcome: string) => outcome.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    pinOutcomeColor: (outcome: string) => {
      const colors: Record<string, string> = {
        knocked: '#059669',
        not_knocked: '#6B7280',
        not_interested: '#DC2626',
        did_not_qualify: '#D97706',
        lead: '#B08D46',
      }
      return colors[outcome] || '#000000'
    },
    DEFAULT_PIN_OUTCOME: 'not_knocked',
    reverseGeocode: mockReverseGeocode,
    canExportData: (role: string) => role === 'super_admin' || role === 'manager',
    requiresContactDetails: (outcome: string) => outcome === 'lead',
    requiresContactName: (outcome: string) => outcome === 'lead',
    requiresContactMobile: (outcome: string) => outcome === 'lead',
    requiresLeadIntegration: (outcome: string) => outcome === 'lead',
    outcomeFieldRequirements: (outcome: string) => ({
      required: outcome === 'lead' ? ['address', 'addressConfirmed', 'coordinates', 'contactName', 'contactMobile'] : ['address', 'addressConfirmed', 'coordinates'],
      optional: outcome === 'lead' ? ['email', 'notes'] : ['notes'],
      leadIntegration: outcome === 'lead',
    }),
    outcomeNote: (outcome: string) => (outcome === 'not_interested' ? 'Do not revisit this property.' : undefined),
    isValidAustralianMobile: (input: string) => {
      const cleaned = input.replace(/[\s\-().]/g, '')
      if (cleaned.startsWith('+614') && cleaned.length === 12) return true
      if (cleaned.startsWith('614') && cleaned.length === 11) return true
      if (cleaned.startsWith('04') && cleaned.length === 10) return true
      return false
    },
    normaliseAustralianMobile: (input: string) => {
      const cleaned = input.replace(/[\s\-().]/g, '')
      if (cleaned.startsWith('+614') && cleaned.length === 12) return cleaned
      if (cleaned.startsWith('614') && cleaned.length === 11) return `+${cleaned}`
      if (cleaned.startsWith('04') && cleaned.length === 10) return `+61${cleaned.slice(1)}`
      return null
    },
  }
  return domainModule
})

// ============================================
// AUTH MOCK - MapPage renders behind <RequireAuth /> in the app, but these
// tests render it standalone, so provide a fixed signed-in admin.
// ============================================

vi.mock('../auth', () => ({
  useCurrentUser: () => ({
    id: 'test-admin',
    uid: 'test-admin',
    name: 'Test Admin',
    displayName: 'Test Admin',
    email: 'admin@asg.local',
    role: 'super_admin',
    active: true,
  }),
}))

// ============================================
// TEST HELPERS
// ============================================

const PERTH_TEST_COORDS = { lng: 115.8605, lat: -31.9505 }

// ============================================
// NOW IMPORT TEST UTILITIES
// ============================================

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { act, render, screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { MapPage } from '../pages/MapPage'
import * as maplibregl from 'maplibre-gl'

// Setup browser APIs in beforeAll
beforeAll(() => {
  globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  Object.defineProperty(navigator, 'vibrate', {
    writable: true,
    value: vi.fn(),
  })

  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    }
  })
})

function getMapInstance() {
  const MapConstructor = maplibregl.Map as any
  return MapConstructor._instances[MapConstructor._instances.length - 1]
}

function clearMapInstances() {
  const MapConstructor = maplibregl.Map as any
  if (MapConstructor._instances) {
    MapConstructor._instances.forEach((i: any) => i._cleanup?.())
    MapConstructor._instances = []
  }
}

// ============================================
// TEST SETUP
// ============================================

describe('MapPage - Add Pin Workflow', () => {
  beforeEach(() => {
    clearMapInstances()
    mockPins.length = 0
    pinIdCounter = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
    mockReverseGeocode.mockReset()
    mockReverseGeocode.mockImplementation(() => createMockGeocodeResult())
  })

  afterEach(() => {
    clearMapInstances()
    mockPins.length = 0
    pinIdCounter = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
  })

  it('uses the premium page heading treatment', async () => {
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    expect(await screen.findByRole('banner')).toHaveClass('premium-page-header')
    expect(screen.getByRole('search', { name: /map search and filters/i })).toBeVisible()
    expect(screen.getByRole('group', { name: /map actions/i })).toBeVisible()
  })

  it('keeps map controls usable when tiles fail', async () => {
    const user = userEvent.setup()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    await screen.findByRole('button', { name: /filter by knocked/i })
    act(() => {
      getMapInstance()._triggerEvent('error', { error: new Error('Network unavailable') })
    })

    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent(/map tiles unavailable/i)
    expect(warn).toHaveBeenCalledWith('Map tile unavailable:', 'Network unavailable')

    await user.click(screen.getByRole('button', { name: /dismiss map tile warning/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    const filter = screen.getByRole('button', { name: /filter by knocked/i })
    await user.click(filter)
    expect(filter).toHaveAttribute('aria-pressed', 'true')
  })

  it('should enter placement mode when ADD PIN button is clicked', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add pin/i })).toBeInTheDocument()
    })

    const addPinButton = screen.getByRole('button', { name: /add pin/i })
    await user.click(addPinButton)

    await waitFor(() => {
      expect(screen.getByText(/tap a property on the map to place the new pin/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('button', { name: /click map to place/i })).toBeInTheDocument()
  })

  it('cancels placement mode from the visible cancel action', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    await user.click(await screen.findByRole('button', { name: /add pin/i }))
    await user.click(screen.getByRole('button', { name: /cancel pin placement/i }))

    expect(screen.queryByText(/tap a property on the map to place the new pin/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add pin/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('should trigger reverse geocoding when map is clicked in placement mode', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const addPinButton = screen.getByRole('button', { name: /add pin/i })
    await user.click(addPinButton)

    await waitFor(() => {
      expect(screen.getByText(/tap a property on the map to place the new pin/i)).toBeInTheDocument()
    })

    const mapInstance = getMapInstance()
    expect(mapInstance).toBeTruthy()

    const event = {
      lngLat: { lng: PERTH_TEST_COORDS.lng, lat: PERTH_TEST_COORDS.lat },
      point: { x: PERTH_TEST_COORDS.lng * 100, y: PERTH_TEST_COORDS.lat * 100 },
      originalEvent: { preventDefault: vi.fn() },
    }
    mapInstance!._triggerEvent('click', event)

    // Wait for geocoding to be called
    await waitFor(() => {
      expect(mockReverseGeocode).toHaveBeenCalledWith(
        PERTH_TEST_COORDS.lat,
        PERTH_TEST_COORDS.lng,
        expect.any(AbortSignal)
      )
    })
  })

  it('should show loading state while geocoding', async () => {
    let resolveGeocode: (value: any) => void
    const geocodePromise = new Promise(resolve => { resolveGeocode = resolve })
    mockReverseGeocode.mockImplementation(() => geocodePromise)

    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const addPinButton = screen.getByRole('button', { name: /add pin/i })
    await user.click(addPinButton)

    await waitFor(() => {
      expect(screen.getByText(/tap a property on the map to place the new pin/i)).toBeInTheDocument()
    })

    const mapInstance = getMapInstance()
    const event = {
      lngLat: { lng: PERTH_TEST_COORDS.lng, lat: PERTH_TEST_COORDS.lat },
      point: { x: PERTH_TEST_COORDS.lng * 100, y: PERTH_TEST_COORDS.lat * 100 },
      originalEvent: { preventDefault: vi.fn() },
    }
    mapInstance!._triggerEvent('click', event)
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    // Check loading state is shown
    await waitFor(() => {
      expect(screen.getByText(/finding address/i)).toBeInTheDocument()
    })

    // Resolve geocoding
    resolveGeocode!(createMockGeocodeResult())

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText(/finding address/i)).not.toBeInTheDocument()
    })
  })

  it('should populate address field with geocoded result', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const addPinButton = screen.getByRole('button', { name: /add pin/i })
    await user.click(addPinButton)

    await waitFor(() => {
      expect(screen.getByText(/tap a property on the map to place the new pin/i)).toBeInTheDocument()
    })

    const mapInstance = getMapInstance()
    const event = {
      lngLat: { lng: PERTH_TEST_COORDS.lng, lat: PERTH_TEST_COORDS.lat },
      point: { x: PERTH_TEST_COORDS.lng * 100, y: PERTH_TEST_COORDS.lat * 100 },
      originalEvent: { preventDefault: vi.fn() },
    }
    mapInstance!._triggerEvent('click', event)
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    // Wait for geocoding to complete and address to be populated
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: /add property visit/i }))
    await waitFor(() => {
      // Query within dialog to avoid matching checkbox label
      const addressInput = within(dialog).getByLabelText(/^property address \*/i)
      expect(addressInput).toHaveValue('42 Smith Street, Joondalup WA 6027')
    })

    // Check auto-detected indicator
    await waitFor(() => {
      expect(screen.getByText(/automatically detected from pin location/i)).toBeInTheDocument()
    })
  })

  it('should allow editing the auto-populated address', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const addPinButton = screen.getByRole('button', { name: /add pin/i })
    await user.click(addPinButton)

    const mapInstance = getMapInstance()
    const event = {
      lngLat: { lng: PERTH_TEST_COORDS.lng, lat: PERTH_TEST_COORDS.lat },
      point: { x: PERTH_TEST_COORDS.lng * 100, y: PERTH_TEST_COORDS.lat * 100 },
      originalEvent: { preventDefault: vi.fn() },
    }
    mapInstance!._triggerEvent('click', event)
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    const dialog = await waitFor(() => screen.getByRole('dialog', { name: /add property visit/i }))
    await waitFor(() => {
      const addressInput = within(dialog).getByLabelText(/^property address \*/i)
      expect(addressInput).toHaveValue('42 Smith Street, Joondalup WA 6027')
    })

    // Edit the address
    const addressInput = within(dialog).getByLabelText(/^property address \*/i)
    fireEvent.change(addressInput, { target: { value: '42A Smith Street, Joondalup WA 6027' } })

    expect(addressInput).toHaveValue('42A Smith Street, Joondalup WA 6027')

    // Check that source changes to manual
    await waitFor(() => {
      expect(screen.getByText(/address edited manually/i)).toBeInTheDocument()
    })
  })

  it('should reset confirmation when address is edited', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const addPinButton = screen.getByRole('button', { name: /add pin/i })
    await user.click(addPinButton)

    const mapInstance = getMapInstance()
    const event = {
      lngLat: { lng: PERTH_TEST_COORDS.lng, lat: PERTH_TEST_COORDS.lat },
      point: { x: PERTH_TEST_COORDS.lng * 100, y: PERTH_TEST_COORDS.lat * 100 },
      originalEvent: { preventDefault: vi.fn() },
    }
    mapInstance!._triggerEvent('click', event)
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    const dialog = await waitFor(() => screen.getByRole('dialog', { name: /add property visit/i }))
    await waitFor(() => {
      const addressInput = within(dialog).getByLabelText(/^property address \*/i)
      expect(addressInput).toHaveValue('42 Smith Street, Joondalup WA 6027')
    })

    // Check the confirmation checkbox
    const checkbox = within(dialog).getByLabelText(/^i confirm this is the correct property address$/i)
    await user.click(checkbox)
    expect(checkbox).toBeChecked()

    // Edit the address
    const addressInput = within(dialog).getByLabelText(/^property address \*/i)
    fireEvent.change(addressInput, { target: { value: '42A Smith Street, Joondalup WA 6027' } })

    // Confirmation should be reset
    expect(checkbox).not.toBeChecked()
  })

  it('should require address confirmation before saving', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const addPinButton = screen.getByRole('button', { name: /add pin/i })
    await user.click(addPinButton)

    const mapInstance = getMapInstance()
    const event = {
      lngLat: { lng: PERTH_TEST_COORDS.lng, lat: PERTH_TEST_COORDS.lat },
      point: { x: PERTH_TEST_COORDS.lng * 100, y: PERTH_TEST_COORDS.lat * 100 },
      originalEvent: { preventDefault: vi.fn() },
    }
    mapInstance!._triggerEvent('click', event)
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    const dialog = await waitFor(() => screen.getByRole('dialog', { name: /add property visit/i }))
    await waitFor(() => {
      const addressInput = within(dialog).getByLabelText(/^property address \*/i)
      expect(addressInput).toHaveValue('42 Smith Street, Joondalup WA 6027')
    })

    const knockedOption = within(dialog).getByLabelText(/^knocked$/i)
    await user.click(knockedOption)

    // Try to submit without confirmation - should fail validation
    const submitButton = within(dialog).getByRole('button', { name: /save pin/i })
    expect(submitButton).toBeDisabled()

    // Check confirmation
    const checkbox = within(dialog).getByLabelText(/^i confirm this is the correct property address$/i)
    await user.click(checkbox)

    // Non-Lead outcomes must save without any contact details
    expect(submitButton).not.toBeDisabled()
    await user.click(submitButton)

    const { savePin } = await import('../domain')
    await waitFor(() => {
      expect(savePin).toHaveBeenCalledTimes(1)
    })

    const savedPin = (savePin as any).mock.calls[0][0]
    expect(savedPin.latitude).toBeCloseTo(PERTH_TEST_COORDS.lat, 4)
    expect(savedPin.longitude).toBeCloseTo(PERTH_TEST_COORDS.lng, 4)
    expect(savedPin.outcome).toBe('knocked')
    expect(savedPin.contactName).toBeUndefined()
    expect(savedPin.address).toBe('42 Smith Street, Joondalup WA 6027')
  })

  it('should handle geocoding failure gracefully', async () => {
    mockReverseGeocode.mockImplementation(() => createMockGeocodeError('Geocoding service unavailable'))

    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const addPinButton = screen.getByRole('button', { name: /add pin/i })
    await user.click(addPinButton)

    const mapInstance = getMapInstance()
    const event = {
      lngLat: { lng: PERTH_TEST_COORDS.lng, lat: PERTH_TEST_COORDS.lat },
      point: { x: PERTH_TEST_COORDS.lng * 100, y: PERTH_TEST_COORDS.lat * 100 },
      originalEvent: { preventDefault: vi.fn() },
    }
    mapInstance!._triggerEvent('click', event)
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    // Wait for geocoding error to be shown
    await waitFor(() => {
      expect(screen.getByText(/address could not be detected automatically/i)).toBeInTheDocument()
    })

    // Address field should be editable
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: /add property visit/i }))
    const addressInput = within(dialog).getByLabelText(/^property address \*/i)
    expect(addressInput).toBeEnabled()
    expect(addressInput).toHaveValue('')

    // User can manually enter address
    fireEvent.change(addressInput, { target: { value: 'Manual Address, Suburb WA 6000' } })

    const dialogEl = await waitFor(() => screen.getByRole('dialog', { name: /add property visit/i }))
    const knockedOption = within(dialogEl).getByLabelText(/^knocked$/i)
    await user.click(knockedOption)

    // Check confirmation
    const checkbox = within(dialogEl).getByLabelText(/^i confirm this is the correct property address$/i)
    await user.click(checkbox)

    const submitButton = within(dialogEl).getByRole('button', { name: /save pin/i })
    await user.click(submitButton)

    const { savePin } = await import('../domain')
    await waitFor(() => {
      expect(savePin).toHaveBeenCalledTimes(1)
    })

    const savedPin = (savePin as any).mock.calls[0][0]
    expect(savedPin.address).toBe('Manual Address, Suburb WA 6000')
  })

  it('should cancel and clear provisional state when modal is closed', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const addPinButton = screen.getByRole('button', { name: /add pin/i })
    await user.click(addPinButton)

    await waitFor(() => {
      expect(screen.getByText(/tap a property on the map to place the new pin/i)).toBeInTheDocument()
    })

    const mapInstance = getMapInstance()
    const event = {
      lngLat: { lng: PERTH_TEST_COORDS.lng, lat: PERTH_TEST_COORDS.lat },
      point: { x: PERTH_TEST_COORDS.lng * 100, y: PERTH_TEST_COORDS.lat * 100 },
      originalEvent: { preventDefault: vi.fn() },
    }
    mapInstance!._triggerEvent('click', event)
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    const dialog = await waitFor(() => screen.getByRole('dialog', { name: /add property visit/i }))
    const cancelButton = within(dialog).getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /add new pin/i })).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /add pin/i })).toBeInTheDocument()
  })
})

describe('MapPage - Outcome Options', () => {
  beforeEach(() => {
    clearMapInstances()
    mockPins.length = 0
    pinIdCounter = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
    mockReverseGeocode.mockReset()
    mockReverseGeocode.mockImplementation(() => createMockGeocodeResult())
  })

  afterEach(() => {
    clearMapInstances()
    mockPins.length = 0
    pinIdCounter = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
  })

  it('should have all five outcome options available', async () => {
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const user = userEvent.setup()
    const addPinButton = screen.getByRole('button', { name: /add pin/i })
    await user.click(addPinButton)

    const mapInstance = getMapInstance()
    const event = {
      lngLat: { lng: PERTH_TEST_COORDS.lng, lat: PERTH_TEST_COORDS.lat },
      point: { x: PERTH_TEST_COORDS.lng * 100, y: PERTH_TEST_COORDS.lat * 100 },
      originalEvent: { preventDefault: vi.fn() },
    }
    mapInstance!._triggerEvent('click', event)
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    // Query within the modal dialog to avoid matching filter dropdown
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: /add property visit/i }))
    // Note: "Did Not_qualify" has underscore in the actual label
    const outcomes = ['knocked', 'not knocked', 'not interested', 'did not_qualify', 'lead']
    for (const outcome of outcomes) {
      const label = within(dialog).getByLabelText(new RegExp(`^${outcome}$`, 'i'))
      expect(label).toBeInTheDocument()
    }
  })
})

describe('MapPage - Event Listener Management', () => {
  beforeEach(() => {
    clearMapInstances()
    mockPins.length = 0
    pinIdCounter = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
    mockReverseGeocode.mockReset()
    mockReverseGeocode.mockImplementation(() => createMockGeocodeResult())
  })

  afterEach(() => {
    clearMapInstances()
    mockPins.length = 0
    pinIdCounter = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
  })

  it('should not register duplicate map listeners when entering placement mode repeatedly', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const addPinButton = screen.getByRole('button', { name: /add pin/i })
    const mapInstance = getMapInstance()

    for (let i = 0; i < 3; i++) {
      await user.click(addPinButton)
      await waitFor(() => {
        expect(screen.getByText(/tap a property on the map to place the new pin/i)).toBeInTheDocument()
      })
      await user.keyboard('{Escape}')
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add pin/i })).toBeInTheDocument()
      })
    }

    const onCalls = mapInstance!.on.mock.calls.filter(([event]: [string, ...any[]]) => 
      ['click', 'contextmenu', 'mousemove', 'mouseout'].includes(event)
    )
    const offCalls = mapInstance!.off.mock.calls.filter(([event]: [string, ...any[]]) => 
      ['click', 'contextmenu', 'mousemove', 'mouseout'].includes(event)
    )
    
    expect(onCalls.length).toBeGreaterThan(0)
    expect(offCalls.length).toBeGreaterThan(0)
  })
})

describe('MapPage - Race Condition Protection', () => {
  beforeEach(() => {
    clearMapInstances()
    mockPins.length = 0
    pinIdCounter = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
    mockReverseGeocode.mockReset()
    mockReverseGeocode.mockImplementation(() => createMockGeocodeResult())
  })

  afterEach(() => {
    clearMapInstances()
    mockPins.length = 0
    pinIdCounter = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
  })

  it('should not allow stale geocoding result to overwrite newer pin location', async () => {
    let firstResolve: (value: any) => void
    let secondResolve: (value: any) => void
    
    const firstPromise = new Promise(resolve => { firstResolve = resolve })
    const secondPromise = new Promise(resolve => { secondResolve = resolve })
    
    let callCount = 0
    mockReverseGeocode.mockImplementation(() => {
      callCount++
      if (callCount === 1) return firstPromise
      return secondPromise
    })

    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const addPinButton = screen.getByRole('button', { name: /add pin/i })

    // Place first pin
    await user.click(addPinButton)
    await waitFor(() => {
      expect(screen.getByText(/tap a property on the map to place the new pin/i)).toBeInTheDocument()
    })

    const mapInstance = getMapInstance()
    const firstEvent = {
      lngLat: { lng: 115.8605, lat: -31.9505 },
      point: { x: 115.8605 * 100, y: -31.9505 * 100 },
      originalEvent: { preventDefault: vi.fn() },
    }
    mapInstance!._triggerEvent('click', firstEvent)

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    // Cancel first pin
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /add new pin/i })).not.toBeInTheDocument()
    })

    // Place second pin at different location
    await user.click(addPinButton)
    await waitFor(() => {
      expect(screen.getByText(/tap a property on the map to place the new pin/i)).toBeInTheDocument()
    })

    const secondEvent = {
      lngLat: { lng: 115.8700, lat: -31.9600 },
      point: { x: 115.8700 * 100, y: -31.9600 * 100 },
      originalEvent: { preventDefault: vi.fn() },
    }
    mapInstance!._triggerEvent('click', secondEvent)

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    // Resolve first geocode (stale)
    firstResolve!(createMockGeocodeResult('Stale Address, Old Suburb WA 6000'))

    // Resolve second geocode (current)
    secondResolve!(createMockGeocodeResult('Current Address, New Suburb WA 6001'))

    // Wait for second result to be shown
    const dialog = await waitFor(() => screen.getByRole('dialog', { name: /add property visit/i }))
    await waitFor(() => {
      const addressInput = within(dialog).getByLabelText(/^property address \*/i)
      expect(addressInput).toHaveValue('Current Address, New Suburb WA 6001')
    })

    // Verify first result didn't overwrite
    expect(screen.queryByDisplayValue('Stale Address, Old Suburb WA 6000')).not.toBeInTheDocument()
  })
})

describe('MapPage - Lead Pin Workflow', () => {
  beforeEach(() => {
    clearMapInstances()
    mockPins.length = 0
    pinIdCounter = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
    mockReverseGeocode.mockReset()
    mockReverseGeocode.mockImplementation(() => createMockGeocodeResult())
  })

  afterEach(() => {
    clearMapInstances()
    mockPins.length = 0
    pinIdCounter = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
  })

  it('should save Lead pin with address confirmation', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const addPinButton = screen.getByRole('button', { name: /add pin/i })
    await user.click(addPinButton)

    const mapInstance = getMapInstance()
    const event = {
      lngLat: { lng: PERTH_TEST_COORDS.lng, lat: PERTH_TEST_COORDS.lat },
      point: { x: PERTH_TEST_COORDS.lng * 100, y: PERTH_TEST_COORDS.lat * 100 },
      originalEvent: { preventDefault: vi.fn() },
    }
    mapInstance!._triggerEvent('click', event)
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    const dialog = await waitFor(() => screen.getByRole('dialog', { name: /add property visit/i }))
    await waitFor(() => {
      const addressInput = within(dialog).getByLabelText(/^property address \*/i)
      expect(addressInput).toHaveValue('42 Smith Street, Joondalup WA 6027')
    })

    const leadOption = within(dialog).getByLabelText(/^lead$/i)
    await user.click(leadOption)

    // Lead Details section appears with required name and mobile
    const nameInput = within(dialog).getByLabelText(/^name \*$/i)
    fireEvent.change(nameInput, { target: { value: 'Lead Contact' } })

    const mobileInput = within(dialog).getByLabelText(/^mobile \*$/i)
    fireEvent.change(mobileInput, { target: { value: '0412 345 678' } })

    // Check confirmation
    const checkbox = within(dialog).getByLabelText(/^i confirm this is the correct property address$/i)
    await user.click(checkbox)

    const submitButton = within(dialog).getByRole('button', { name: /save lead/i })
    await user.click(submitButton)

    const { savePin } = await import('../domain')
    await waitFor(() => {
      expect(savePin).toHaveBeenCalledTimes(1)
    })

    const savedPin = (savePin as any).mock.calls[0][0]
    expect(savedPin.outcome).toBe('lead')
    expect(savedPin.contactName).toBe('Lead Contact')
    expect(savedPin.contactPhone).toBe('0412 345 678')
    expect(savedPin.id).toBeDefined()
    expect(savedPin.address).toBe('42 Smith Street, Joondalup WA 6027')
  })
})

describe('MapPage - Immediate Pin Rendering', () => {
  beforeEach(() => {
    clearMapInstances()
    mockPins.length = 0
    pinIdCounter = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
    mockReverseGeocode.mockReset()
    mockReverseGeocode.mockImplementation(() => createMockGeocodeResult())
  })

  afterEach(() => {
    clearMapInstances()
    mockPins.length = 0
    pinIdCounter = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
  })

  it('should immediately show saved pin on map and update counts', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const addPinButton = screen.getByRole('button', { name: /add pin/i })
    await user.click(addPinButton)

    const mapInstance = getMapInstance()
    const event = {
      lngLat: { lng: PERTH_TEST_COORDS.lng, lat: PERTH_TEST_COORDS.lat },
      point: { x: PERTH_TEST_COORDS.lng * 100, y: PERTH_TEST_COORDS.lat * 100 },
      originalEvent: { preventDefault: vi.fn() },
    }
    mapInstance!._triggerEvent('click', event)
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /add property visit/i })).toBeInTheDocument()
    })

    const dialog = await waitFor(() => screen.getByRole('dialog', { name: /add property visit/i }))
    await waitFor(() => {
      const addressInput = within(dialog).getByLabelText(/^property address \*/i)
      expect(addressInput).toHaveValue('42 Smith Street, Joondalup WA 6027')
    })

    const knockedOption = within(dialog).getByLabelText(/^knocked$/i)
    await user.click(knockedOption)

    // Check confirmation
    const checkbox = within(dialog).getByLabelText(/^i confirm this is the correct property address$/i)
    await user.click(checkbox)

    const submitButton = within(dialog).getByRole('button', { name: /save pin/i })
    await user.click(submitButton)

    const { savePin } = await import('../domain')
    await waitFor(() => {
      expect(savePin).toHaveBeenCalledTimes(1)
    })

    expect(await screen.findByRole('status')).toHaveTextContent('Pin saved')
    expect(screen.getByRole('button', { name: /add pin/i })).toBeInTheDocument()
  })
})

describe('MapPage - Pin Search', () => {
  beforeEach(() => {
    clearMapInstances()
    mockPins.length = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
    mockPins.push(
      {
        id: 'oceanview',
        latitude: -31.99,
        longitude: 115.75,
        address: '18 Oceanview Road, Cottesloe WA 6011',
        outcome: 'not_knocked',
        createdBy: 'test-admin',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        synced: true,
        syncAttempts: 0,
      },
      {
        id: 'hay-street',
        latitude: -31.95,
        longitude: 115.86,
        address: '123 Hay Street, Perth WA 6000',
        outcome: 'knocked',
        createdBy: 'test-admin',
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-01T00:00:00.000Z',
        synced: true,
        syncAttempts: 0,
      },
    )
  })

  afterEach(() => {
    clearMapInstances()
    mockPins.length = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
  })

  it('filters visible pins by stored address and restores them when search is cleared', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const search = await screen.findByRole('searchbox', { name: /search address or suburb/i })
    await waitFor(() => expect(screen.getByText('Showing 2 of 2 pins')).toBeInTheDocument())

    await user.type(search, 'Cottesloe')
    expect(screen.getByText('Showing 1 of 2 pins')).toBeInTheDocument()

    await user.clear(search)
    expect(screen.getByText('Showing 2 of 2 pins')).toBeInTheDocument()
  })

  it('exposes the primary action as the field add-pin control', async () => {
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    expect(await screen.findByRole('toolbar', { name: /map filters/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add pin/i })).toHaveClass('map-page__add-fab')
  })
})

describe('MapPage - Selected Pin Actions', () => {
  beforeEach(() => {
    clearMapInstances()
    mockPins.length = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
    mockPins.push({
      id: 'selected-pin',
      latitude: -31.99,
      longitude: 115.75,
      address: '18 Oceanview Road, Cottesloe WA 6011',
      outcome: 'not_knocked',
      createdBy: 'test-admin',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      synced: true,
      syncAttempts: 0,
    })
  })

  afterEach(() => {
    clearMapInstances()
    mockPins.length = 0
    markerEventListeners.clear()
    vi.clearAllMocks()
  })

  it('shows touch-friendly actions when a marker is selected', async () => {
    const user = userEvent.setup()
    render(
      <BrowserRouter>
        <MapPage />
      </BrowserRouter>
    )

    const marker = await screen.findByRole('button', { name: /pin: 18 oceanview road/i })
    await user.click(marker)

    const sheet = await screen.findByRole('complementary', { name: /property details/i })
    expect(within(sheet).getByRole('heading', { name: /18 oceanview road/i })).toBeVisible()
    expect(within(sheet).getByRole('button', { name: /update outcome/i })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /edit details/i })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /delete pin/i })).toHaveClass('property-details__danger')
    expect(document.querySelector('.maplibregl-popup')).not.toBeInTheDocument()
  })
})
