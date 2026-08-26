import { useRef, useEffect } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './MapPage.css'

export function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)

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
            <option value="knocked">Knocked</option>
            <option value="not_knocked">Not Knocked</option>
            <option value="not_interested">Not Interested</option>
            <option value="did_not_qualify">Did Not Qualify</option>
            <option value="lead">Lead</option>
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
        <div className="legend__item">
          <span className="legend__color" style={{ backgroundColor: '#3B82F6' }} aria-hidden="true"></span>
          <span>Knocked</span>
        </div>
        <div className="legend__item">
          <span className="legend__color" style={{ backgroundColor: '#9CA3AF' }} aria-hidden="true"></span>
          <span>Not Knocked</span>
        </div>
        <div className="legend__item">
          <span className="legend__color" style={{ backgroundColor: '#EF4444' }} aria-hidden="true"></span>
          <span>Not Interested</span>
        </div>
        <div className="legend__item">
          <span className="legend__color" style={{ backgroundColor: '#F59E0B' }} aria-hidden="true"></span>
          <span>Did Not Qualify</span>
        </div>
        <div className="legend__item">
          <span className="legend__color" style={{ backgroundColor: '#10B981' }} aria-hidden="true"></span>
          <span>Lead</span>
        </div>
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