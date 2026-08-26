import type { Pin } from '../domain'
import { pinOutcomeColor } from '../domain'
import './MapMarker.css'

interface MapMarkerProps {
  pin: Pin
  onClick: (pin: Pin) => void
  isSelected?: boolean
}

export function MapMarker({ pin, onClick, isSelected = false }: MapMarkerProps) {
  const color = pinOutcomeColor(pin.outcome)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onClick(pin)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick(pin)
    }
  }

  return (
    <div
      className={`map-marker ${isSelected ? 'map-marker--selected' : ''}`}
      style={{
        '--marker-color': color,
      } as React.CSSProperties}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Pin: ${pin.address || 'Unknown location'}, ${pin.outcome}`}
      aria-pressed={isSelected}
    >
      <div className="map-marker__inner">
        <div className="map-marker__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
          </svg>
        </div>
      </div>
      {isSelected && (
        <div className="map-marker__pulse" aria-hidden="true" />
      )}
    </div>
  )
}

interface MapMarkerClusterProps {
  count: number
  onClick: () => void
}

export function MapMarkerCluster({ count, onClick }: MapMarkerClusterProps) {
  return (
    <div
      className="map-marker-cluster"
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label={`Cluster of ${count} pins`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
    >
      <span>{count}</span>
    </div>
  )
}