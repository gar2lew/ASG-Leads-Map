import { useRef, useEffect, useMemo } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { PinOutcome, pinOutcomeOrder, pinOutcomeLabel } from '../domain'
import './MapPage.css'

export function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

  // Use brand-styled pin colors
  const pinColors = useMemo(() => ({
    [PinOutcome.Knocked]: '#059669',       // Emerald (success)
    [PinOutcome.NotKnocked]: '#6B7280',    // Slate Gray (muted)
    [PinOutcome.NotInterested]: '#DC2626', // Red (error)
    [PinOutcome.DidNotQualify]: '#D97706', // Amber (warning)
    [PinOutcome.Lead]: '#B08D46',          // Muted Gold (accent)
  }), [])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'osm': {
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
      center: [115.8605, -31.9505],
      zoom: 10,
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

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div className="map-page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Field Map</h1>
          <p className="page__subtitle">Tap pins to update outcomes. Long press to add new pins.</p>
        </div>
        <div className="page__actions">
          <button className="btn btn--primary" type="button">
            <svg className="icon btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Pin
          </button>
          <button className="btn btn--secondary" type="button">
            <svg className="icon btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M3 3h18v18H3z" />
              <path d="M12 8v8M8 12h8" />
            </svg>
            Sync
          </button>
        </div>
      </header>

      <div className="map-page__toolbar toolbar" role="toolbar" aria-label="Map filters">
        <div className="toolbar__group">
          <label htmlFor="outcome-filter" className="visually-hidden">Filter by outcome</label>
          <select id="outcome-filter" className="form-input" style={{ width: 'auto', minWidth: '180px' }}>
            <option value="">All Outcomes</option>
            {pinOutcomeOrder.map((outcome) => (
              <option key={outcome} value={outcome}>{pinOutcomeLabel(outcome)}</option>
            ))}
          </select>
        </div>
        <div className="toolbar__group">
          <label htmlFor="rep-filter" className="visually-hidden">Filter by rep</label>
          <select id="rep-filter" className="form-input" style={{ width: 'auto', minWidth: '180px' }}>
            <option value="">All Reps</option>
            <option value="me">My Pins</option>
            <option value="team">Team Pins</option>
          </select>
        </div>
        <div className="toolbar__spacer" />
        <div className="toolbar__group">
          <button className="btn btn--outline btn--sm" type="button">
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
              style={{ backgroundColor: pinColors[outcome] }}
              aria-hidden="true"
            ></span>
            <span>{pinOutcomeLabel(outcome)}</span>
          </div>
        ))}
      </div>

      <div
        ref={mapContainerRef}
        className="map-page__map"
        role="application"
        aria-label="Interactive map of sales territory"
      />
    </div>
  )
}