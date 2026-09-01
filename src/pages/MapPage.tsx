import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
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
  canExportData,
} from '../domain'
import { useCurrentUser } from '../auth'
import { PinModal } from '../components/PinModal'
import { MapFeedback, type MapFeedbackValue } from '../components/MapFeedback'
import { SelectedPinSheet } from '../components/SelectedPinSheet'
import './MapPage.css'

const PERTH_CENTER: [number, number] = [115.8605, -31.9505]
const PERTH_ZOOM = 10

export function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, HTMLElement>>(new Map())
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const provisionalMarkerRef = useRef<maplibregl.Marker | null>(null)
  const tileErrorRef = useRef<HTMLDivElement | null>(null)

  const [pins, setPins] = useState<Pin[]>([])
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState<PinOutcome | ''>('')
  const [repFilter, setRepFilter] = useState<'all' | 'me' | 'team'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [pendingCoordinates, setPendingCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [editingPin, setEditingPin] = useState<Pin | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [outcomeCounts, setOutcomeCounts] = useState<Record<string, number>>({})
  const [isAddingPin, setIsAddingPin] = useState(false)
  const [showTileError, setShowTileError] = useState(false)
  const [feedback, setFeedback] = useState<MapFeedbackValue | null>(null)
  const currentUser = useCurrentUser()
  const showExport = canExportData(currentUser.role)

  const filteredPins = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    return pins.filter((pin) => {
      if (outcomeFilter && pin.outcome !== outcomeFilter) return false
      if (repFilter === 'me' && pin.createdBy !== currentUser.uid) return false
      if (query && !pin.address?.toLocaleLowerCase().includes(query)) return false
      return true
    })
  }, [currentUser.uid, outcomeFilter, pins, repFilter, searchQuery])
  const selectedPin = pins.find((pin) => pin.id === selectedPinId) ?? null

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

  const createProvisionalMarker = () => {
    if (provisionalMarkerRef.current) return
    const el = document.createElement('div')
    el.className = 'map-marker map-marker--provisional'
    el.style.setProperty('--marker-color', 'var(--asg-color-gold-600)')
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
    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
    provisionalMarkerRef.current = marker
  }

  const updateProvisionalMarker = (lngLat: maplibregl.LngLat) => {
    if (!provisionalMarkerRef.current) {
      createProvisionalMarker()
    }
    const lngLatObj: maplibregl.LngLatLike = { lng: lngLat.lng, lat: lngLat.lat }
    provisionalMarkerRef.current!.setLngLat(lngLatObj)
    if (!mapRef.current) return
    try {
      provisionalMarkerRef.current!.addTo(mapRef.current!)
    } catch {
      // Already added
    }
  }

  const removeProvisionalMarker = () => {
    if (provisionalMarkerRef.current) {
      provisionalMarkerRef.current.remove()
      provisionalMarkerRef.current = null
    }
  }

  // Initialize map (runs once on mount)
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          satellite: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
          },
        },
        layers: [
          {
            id: 'satellite',
            type: 'raster',
            source: 'satellite',
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

    mapRef.current = map

    // Test-only helper to trigger a map click for E2E tests
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      ;(window as any).__testTriggerMapClick = (lngLat: { lng: number; lat: number }) => {
        if (mapRef.current) {
          mapRef.current.fire('click', {
            lngLat,
            point: { x: 0, y: 0 },
            originalEvent: new MouseEvent('click'),
          })
        }
      }
    }

    const markers = markersRef.current
    return () => {
      map.remove()
      mapRef.current = null
      markers.clear()
    }
  }, [])

  // Handle map tile errors
  useEffect(() => {
    if (!mapRef.current) return

    const map = mapRef.current

    const handleError = (e: unknown) => {
      console.warn('Map tile error:', e)
      setShowTileError(true)
    }

    map.on('error', handleError)

    return () => {
      map.off('error', handleError)
    }
  }, [])

  // Manage map event listeners for pin placement mode
  useEffect(() => {
    if (!mapRef.current) return

    const map = mapRef.current

    // Handle map click for adding pins - simple click/tap when in placement mode
    const handleMapClick = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
      if (!isAddingPin) return
      const lngLat = e.lngLat
      setPendingCoordinates({ latitude: lngLat.lat, longitude: lngLat.lng })
      setEditingPin(null)
      setIsModalOpen(true)
      setIsAddingPin(false)
      removeProvisionalMarker()
    }

    // Right-click also places pin
    const handleContextMenu = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault()
      if (!isAddingPin) return
      const lngLat = e.lngLat
      setPendingCoordinates({ latitude: lngLat.lat, longitude: lngLat.lng })
      setEditingPin(null)
      setIsModalOpen(true)
      setIsAddingPin(false)
      removeProvisionalMarker()
    }

    // Show provisional marker on mouse move during placement mode
    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!isAddingPin) return
      updateProvisionalMarker(e.lngLat)
    }

    // Remove provisional marker when mouse leaves map
    const handleMouseLeave = () => {
      removeProvisionalMarker()
    }

    // Escape key to cancel placement mode
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isAddingPin) {
        setIsAddingPin(false)
        removeProvisionalMarker()
      }
    }

    if (isAddingPin) {
      map.on('click', handleMapClick)
      map.on('contextmenu', handleContextMenu)
      map.on('mousemove', handleMouseMove)
      map.on('mouseout', handleMouseLeave)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      map.off('click', handleMapClick)
      map.off('contextmenu', handleContextMenu)
      map.off('mousemove', handleMouseMove)
      map.off('mouseout', handleMouseLeave)
      document.removeEventListener('keydown', handleKeyDown)
      removeProvisionalMarker()
    }
  }, [isAddingPin])

  // Render pins whenever pins or filters change
  useEffect(() => {
    if (!mapRef.current) return
    renderPins()
  }, [filteredPins, selectedPinId])

  const handleAddPinClick = () => {
    setIsAddingPin(true)
  }

  const cancelPinPlacement = () => {
    setIsAddingPin(false)
    removeProvisionalMarker()
  }

  const handlePinClick = useCallback((pin: Pin) => {
    setSelectedPinId(pin.id)
    showPopup(pin)
  }, [])

  const editSelectedPin = () => {
    if (!selectedPin) return
    setEditingPin(selectedPin)
    setPendingCoordinates(null)
    setIsModalOpen(true)
    popupRef.current?.remove()
  }

  const deleteSelectedPin = async () => {
    if (!selectedPin || !confirm('Delete this pin?')) return
    await deletePin(selectedPin.id)
    popupRef.current?.remove()
    setSelectedPinId(null)
  }

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
          <span class="map-popup__outcome-badge" style="background: ${color}20; color: ${color}; border: 1px solid ${color};">
            ${pinOutcomeLabel(pin.outcome)}
          </span>
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
          ${pin.outcome === 'lead' ? `
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
          ` : ''}
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
    const wasEditing = Boolean(editingPin)
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
        const newPin = createPin(createPinData, currentUser.uid)
        await savePin(newPin)
        setPins((prev) => [...prev, newPin])
      }
      await loadPins()
      setIsModalOpen(false)
      setEditingPin(null)
      setPendingCoordinates(null)
      setFeedback({ kind: 'success', message: wasEditing ? 'Pin updated' : 'Pin saved' })
    } catch (error) {
      console.error('Failed to save pin:', error)
      setFeedback({ kind: 'error', message: 'Failed to save pin. Please try again.' })
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

  const handleExportCsv = () => {
    import('../domain/csv').then(({ exportPinsToCsv }) => {
      const csv = exportPinsToCsv(pins)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = `asg-leads-pins-${new Date().toISOString().split('T')[0]}.csv`
      link.click()
      URL.revokeObjectURL(link.href)
    })
  }

  // Outcome chip helper
  const getOutcomeChipClass = (outcome: PinOutcome) => {
    const base = 'outcome-chip'
    const selected = outcomeFilter === outcome ? '--selected' : ''
    const typeMap: Record<PinOutcome, string> = {
      knocked: 'knocked',
      not_knocked: 'not-knocked',
      not_interested: 'not-interested',
      did_not_qualify: 'did-not-qualify',
      lead: 'lead',
    }
    const type = typeMap[outcome] || outcome
    return `${base} outcome-chip--${type}${selected ? ' outcome-chip--selected' : ''}`
  }

  return (
    <div className="map-page">
      {/* Page Header */}
      <header className="map-page__header">
        <div className="map-page__title-block">
          <h1 className="map-page__title">Field Map</h1>
          <p className="map-page__subtitle">Track visits, outcomes and leads across your territory.</p>
        </div>
        <div className="map-page__actions">
          <button
            className="btn btn--primary map-page__add-fab"
            type="button"
            onClick={handleAddPinClick}
            aria-pressed={isAddingPin}
            disabled={isLoading}
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
          {showExport && (
            <button className="btn btn--outline btn--sm" type="button" disabled={pins.length === 0} onClick={handleExportCsv}>
              <svg className="icon btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Export CSV
            </button>
          )}
        </div>
      </header>

      {/* Add Pin Hint Banner */}
      {isAddingPin && (
        <div className="map-page__add-hint" role="status" aria-live="polite">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>Tap a property on the map to place the new pin. Press Escape to cancel.</span>
          <button
            type="button"
            className="btn btn--ghost btn--sm map-page__cancel-placement"
            onClick={cancelPinPlacement}
            aria-label="Cancel pin placement"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Unified Filter Bar */}
      <div className="map-page__filter-bar" role="toolbar" aria-label="Map filters">
        {/* Search - placeholder for future */}
        <div className="map-page__filter-group" style={{ flex: 1, minWidth: 200 }}>
          <label htmlFor="map-search" className="visually-hidden">Search address or suburb</label>
          <input
            id="map-search"
            type="search"
            className="form-input"
            placeholder="Search address or suburb…"
            style={{ minWidth: 200, maxWidth: 320 }}
            aria-label="Search address or suburb"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        {/* Outcome Filter Chips */}
        <div className="map-page__filter-group">
          <span className="map-page__filter-label">Outcome</span>
          <div className="outcome-chips" role="group" aria-label="Filter by outcome">
            {pinOutcomeOrder.map((outcome) => (
              <button
                key={outcome}
                type="button"
                className={getOutcomeChipClass(outcome)}
                onClick={() => setOutcomeFilter(outcomeFilter === outcome ? '' : outcome)}
                aria-pressed={outcomeFilter === outcome}
                aria-label={`Filter by ${pinOutcomeLabel(outcome)} (${outcomeCounts[outcome] || 0})`}
              >
                <span className="outcome-chip__dot" aria-hidden="true" />
                <span>{pinOutcomeLabel(outcome)}</span>
                <span className="outcome-chip__count">{outcomeCounts[outcome] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Rep Filter */}
        <div className="map-page__filter-group rep-filter-wrapper">
          <label htmlFor="rep-filter" className="map-page__filter-label">Rep</label>
          <select
            id="rep-filter"
            className="form-input"
            value={repFilter}
            onChange={(e) => setRepFilter(e.target.value as 'all' | 'me' | 'team')}
            style={{ minWidth: 140 }}
          >
            <option value="all">All Reps</option>
            <option value="me">My Pins</option>
            <option value="team">Team Pins</option>
          </select>
        </div>

        {/* Toolbar Actions */}
        <div className="map-page__toolbar-actions">
          <span className="toolbar__count" aria-live="polite">
            Showing {filteredPins.length} of {pins.length} pins
          </span>
        </div>
      </div>

      {/* Map Container */}
      <div className="map-page__map-wrapper">
        <div
          ref={mapContainerRef}
          className="map-page__map"
          role="application"
          aria-label="Interactive map of sales territory"
        />

        {/* Tile Error Overlay */}
        {showTileError && (
          <div className="map-page__tile-error" ref={tileErrorRef} role="alert">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h3 className="map-page__tile-error__title">Map Tiles Unavailable</h3>
            <p className="map-page__tile-error__message">Unable to load map imagery. Check your connection or try again later.</p>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              style={{ marginTop: 'var(--asg-space-2)' }}
              onClick={() => { setShowTileError(false); mapRef.current?.resize(); }}
            >
              Retry
            </button>
          </div>
        )}

        <MapFeedback feedback={feedback} onDismiss={() => setFeedback(null)} />

        {selectedPin && (
          <SelectedPinSheet
            pin={selectedPin}
            onUpdateOutcome={editSelectedPin}
            onEdit={editSelectedPin}
            onDelete={deleteSelectedPin}
            onClose={() => setSelectedPinId(null)}
          />
        )}
      </div>

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
