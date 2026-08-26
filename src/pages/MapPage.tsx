import { useRef, useEffect, useState, useCallback } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Pin, PinOutcome } from '../domain'
import type { CreatePinInput } from '../domain'
import {
  pinOutcomeOrder,
  pinOutcomeLabel,
  pinOutcomeColor,
  getAllPins,
  savePin,
  getPinCountByOutcome,
  createPin,
} from '../domain'
import { PinModal } from '../components/PinModal'
import './MapPage.css'

const PERTH_CENTER: [number, number] = [115.8605, -31.9505]
const PERTH_ZOOM = 10

export function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, HTMLElement>>(new Map())
  const popupRef = useRef<maplibregl.Popup | null>(null)

  const [pins, setPins] = useState<Pin[]>([])
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [outcomeFilter, setOutcomeFilter] = useState<PinOutcome | ''>('')
  const [repFilter, setRepFilter] = useState<'all' | 'me' | 'team'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pendingCoordinates, setPendingCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [editingPin, setEditingPin] = useState<Pin | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [outcomeCounts, setOutcomeCounts] = useState<Record<string, number>>({})
  const [isAddingPin, setIsAddingPin] = useState(false)

  // Load pins on mount
  useEffect(() => {
    loadPins()
  }, [])

  const loadPins = async () => {
    setIsLoading(true)
    try {
      const [loadedPins, counts] = await Promise.all([getAllPins(), getPinCountByOutcome()])
      setPins(loadedPins)
      setOutcomeCounts(counts)
    } catch (error) {
      console.error('Failed to load pins:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: PERTH_CENTER,
      zoom: PERTH_ZOOM,
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.FullscreenControl(), 'top-right')
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      'top-right'
    )

    // Handle map click for adding pins
    map.on('click', handleMapClick)

    mapRef.current = map

    return () => {
      map.off('click', handleMapClick)
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [])

  // Render pins whenever pins or filters change
  useEffect(() => {
    if (!mapRef.current) return
    renderPins()
  }, [pins, outcomeFilter, repFilter, selectedPinId])

  const handleMapClick = (e: maplibregl.MapMouseEvent) => {
    if (isAddingPin) {
      const lngLat = e.lngLat
      setPendingCoordinates({ latitude: lngLat.lat, longitude: lngLat.lng })
      setEditingPin(null)
      setIsModalOpen(true)
      setIsAddingPin(false)
    }
  }

  const handleAddPinClick = () => {
    setIsAddingPin(true)
  }

  const handlePinClick = useCallback((pin: Pin) => {
    setSelectedPinId(pin.id)
    showPopup(pin)
  }, [])

  const showPopup = (pin: Pin) => {
    if (!mapRef.current) return

    if (popupRef.current) {
      popupRef.current.remove()
    }

    const color = pinOutcomeColor(pin.outcome)

    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 25 })
      .setLngLat([pin.longitude, pin.latitude])
      .setHTML(renderPopupHTML(pin, color))
      .addTo(mapRef.current)

    popupRef.current = popup

    // Attach event listeners after popup is added
    setTimeout(() => attachPopupListeners(pin), 0)
  }

  const attachPopupListeners = (pin: Pin) => {
    const popupElement = document.querySelector('.map-popup')
    if (!popupElement) return

    const editBtn = popupElement.querySelector('[data-action="edit"]')
    const deleteBtn = popupElement.querySelector('[data-action="delete"]')
    const changeOutcomeBtn = popupElement.querySelector('[data-action="change-outcome"]')

    editBtn?.addEventListener('click', () => {
      setEditingPin(pin)
      setPendingCoordinates(null)
      setIsModalOpen(true)
      popupRef.current?.remove()
    })

    deleteBtn?.addEventListener('click', async () => {
      if (confirm('Delete this pin?')) {
        await deletePin(pin.id)
        popupRef.current?.remove()
        setSelectedPinId(null)
      }
    })

    changeOutcomeBtn?.addEventListener('click', () => {
      setEditingPin(pin)
      setPendingCoordinates(null)
      setIsModalOpen(true)
      popupRef.current?.remove()
    })
  }

  const renderPopupHTML = (pin: Pin, color: string): string => {
    return `
      <div class="map-popup" style="--marker-color: ${color};">
        <div class="map-popup__header">
          <span class="map-popup__outcome-badge">${pinOutcomeLabel(pin.outcome)}</span>
        </div>
        <div class="map-popup__body">
          ${pin.address ? `
            <div class="map-popup__address">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span>${escapeHtml(pin.address)}</span>
            </div>
          ` : ''}
          <div class="map-popup__details">
            ${pin.contactName ? `
              <div class="map-popup__detail">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span>${escapeHtml(pin.contactName)}</span>
              </div>
            ` : ''}
            ${pin.contactPhone ? `
              <div class="map-popup__detail">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>${escapeHtml(pin.contactPhone)}</span>
              </div>
            ` : ''}
            ${pin.contactEmail ? `
              <div class="map-popup__detail">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>${escapeHtml(pin.contactEmail)}</span>
              </div>
            ` : ''}
          </div>
          <div class="map-popup__actions">
            <button class="map-popup__btn map-popup__btn--primary" data-action="change-outcome">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Change Outcome
            </button>
            <button class="map-popup__btn map-popup__btn--secondary" data-action="edit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Details
            </button>
            <button class="map-popup__btn map-popup__btn--danger" data-action="delete">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Delete
            </button>
          </div>
        </div>
      </div>
    `
  }

  const renderPins = () => {
    if (!mapRef.current) return

    // Clear existing markers
    markersRef.current.forEach((element) => element.remove())
    markersRef.current.clear()
    if (popupRef.current) {
      popupRef.current.remove()
      popupRef.current = null
    }

    // Filter pins
    const filteredPins = pins.filter((pin) => {
      if (outcomeFilter && pin.outcome !== outcomeFilter) return false
      if (repFilter === 'me' && pin.createdBy !== 'current-user') return false
      // 'team' and 'all' show all for now
      return true
    })

    // Add markers for each pin
    filteredPins.forEach((pin) => {
      const el = document.createElement('div')
      const color = pinOutcomeColor(pin.outcome)

      el.className = `map-marker ${pin.id === selectedPinId ? 'map-marker--selected' : ''}`
      el.style.setProperty('--marker-color', color)
      el.innerHTML = `
        <div class="map-marker__inner">
          <div class="map-marker__icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
          </div>
        </div>
        <div class="map-marker__pulse" aria-hidden="true"></div>
      `

      el.addEventListener('click', (e) => {
        e.stopPropagation()
        handlePinClick(pin)
      })

      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handlePinClick(pin)
        }
      })

      el.tabIndex = 0
      el.setAttribute('role', 'button')
      el.setAttribute('aria-label', `Pin: ${pin.address || 'Unknown location'}, ${pin.outcome}`)
      el.setAttribute('aria-pressed', pin.id === selectedPinId ? 'true' : 'false')

      const lngLat: maplibregl.LngLatLike = { lng: pin.longitude, lat: pin.latitude }
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      marker.setLngLat(lngLat)
      marker.addTo(mapRef.current!)

      markersRef.current.set(pin.id, el)
    })
  }

  const handleSavePin = async (data: { latitude: number; longitude: number; outcome: PinOutcome; address?: string; notes?: string; contactName?: string; contactPhone?: string; contactEmail?: string }) => {
    setIsLoading(true)
    try {
      if (editingPin) {
        // Update existing pin
        const updatedPin = { ...editingPin, ...data, updatedAt: new Date().toISOString(), synced: false } as Pin
        await savePin(updatedPin)
        setPins((prev) => prev.map((p) => (p.id === editingPin.id ? updatedPin : p)))
      } else {
        // Create new pin
        const createPinData: CreatePinInput = {
          latitude: data.latitude,
          longitude: data.longitude,
          outcome: data.outcome,
          address: data.address ?? undefined,
          notes: data.notes ?? undefined,
          contactName: data.contactName ?? undefined,
          contactPhone: data.contactPhone ?? undefined,
          contactEmail: data.contactEmail ?? undefined,
        }
        const newPin = createPin(createPinData, 'current-user')
        await savePin(newPin)
        setPins((prev) => [...prev, newPin])
      }
      await loadPins()
      setIsModalOpen(false)
      setEditingPin(null)
      setPendingCoordinates(null)
    } catch (error) {
      console.error('Failed to save pin:', error)
      alert('Failed to save pin. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const deletePin = async (id: string) => {
    const pinToDelete = pins.find((p) => p.id === id)
    if (pinToDelete) {
      await savePin({ ...pinToDelete, synced: false } as Pin)
    }
    // For now just remove locally
    setPins((prev) => prev.filter((p) => p.id !== id))
    const { deletePin: deleteFromStorage } = await import('../domain/pinStorage')
    await deleteFromStorage(id)
    await loadPins()
  }

  const filteredPins = pins.filter((pin) => {
    if (outcomeFilter && pin.outcome !== outcomeFilter) return false
    if (repFilter === 'me' && pin.createdBy !== 'current-user') return false
    return true
  })

  return (
    <div className="map-page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Field Map</h1>
          <p className="page__subtitle">Tap pins to update outcomes. Long press to add new pins.</p>
        </div>
        <div className="page__actions">
          <button
            className="btn btn--primary"
            type="button"
            onClick={handleAddPinClick}
            aria-pressed={isAddingPin}
          >
            <svg className="icon btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {isAddingPin ? 'Click Map to Place' : 'Add Pin'}
          </button>
          <button className="btn btn--secondary" type="button" disabled={isLoading}>
            <svg className="icon btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 3h18v18H3z" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            Sync
          </button>
        </div>
      </header>

      {isAddingPin && (
        <div className="map-page__add-hint" role="status" aria-live="polite">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          Click on the map to place a pin. Press Escape to cancel.
        </div>
      )}

      <div className="map-page__toolbar toolbar" role="toolbar" aria-label="Map filters">
        <div className="toolbar__group">
          <label htmlFor="outcome-filter" className="visually-hidden">Filter by outcome</label>
          <select
            id="outcome-filter"
            className="form-input"
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value as PinOutcome | '')}
            style={{ width: 'auto', minWidth: '180px' }}
          >
            <option value="">All Outcomes ({pins.length})</option>
            {pinOutcomeOrder.map((outcome) => (
              <option key={outcome} value={outcome}>
                {pinOutcomeLabel(outcome)} ({outcomeCounts[outcome] || 0})
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar__group">
          <label htmlFor="rep-filter" className="visually-hidden">Filter by rep</label>
          <select
            id="rep-filter"
            className="form-input"
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value as 'all' | 'me' | 'team')}
            style={{ width: 'auto', minWidth: '180px' }}
          >
            <option value="all">All Reps</option>
            <option value="me">My Pins</option>
            <option value="team">Team Pins</option>
          </select>
        </div>
        <div className="toolbar__spacer" />
        <div className="toolbar__group">
          <span className="toolbar__count" aria-live="polite">
            Showing {filteredPins.length} of {pins.length} pins
          </span>
          <button className="btn btn--outline btn--sm" type="button" disabled={pins.length === 0}>
            <svg className="icon btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      <div className="map-page__legend" aria-label="Pin outcome legend">
        {pinOutcomeOrder.map((outcome) => (
          <div key={outcome} className="legend__item">
            <span
              className="legend__color"
              style={{ backgroundColor: pinOutcomeColor(outcome) }}
              aria-hidden="true"
            ></span>
            <span>{pinOutcomeLabel(outcome)} ({outcomeCounts[outcome] || 0})</span>
          </div>
        ))}
      </div>

      <div
        ref={mapContainerRef}
        className="map-page__map"
        role="application"
        aria-label="Interactive map of sales territory"
      />

      <PinModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingPin(null)
          setPendingCoordinates(null)
        }}
        onSave={handleSavePin}
        initialPin={editingPin}
        initialCoordinates={pendingCoordinates}
        isLoading={isLoading}
      />
    </div>
  )
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}