import type { Pin } from '../domain'
import { pinOutcomeLabel } from '../domain'
import './SelectedPinSheet.css'

interface SelectedPinSheetProps {
  pin: Pin
  onUpdateOutcome: () => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}

export function SelectedPinSheet({ pin, onUpdateOutcome, onEdit, onDelete, onClose }: SelectedPinSheetProps) {
  return (
    <aside className="selected-pin-sheet" aria-label="Selected property">
      <div className="selected-pin-sheet__handle" aria-hidden="true" />
      <button
        type="button"
        className="selected-pin-sheet__close"
        onClick={onClose}
        aria-label="Close selected property"
      >
        ×
      </button>
      <div className="selected-pin-sheet__heading">
        <span className={`selected-pin-sheet__outcome selected-pin-sheet__outcome--${pin.outcome}`}>
          {pinOutcomeLabel(pin.outcome)}
        </span>
        <h2 className="selected-pin-sheet__address">{pin.address || 'Unknown property'}</h2>
      </div>
      {pin.outcome === 'lead' && (pin.contactName || pin.contactPhone || pin.contactEmail) && (
        <div className="selected-pin-sheet__contact">
          {pin.contactName && <span>{pin.contactName}</span>}
          {pin.contactPhone && <a href={`tel:${pin.contactPhone}`}>{pin.contactPhone}</a>}
          {pin.contactEmail && <a href={`mailto:${pin.contactEmail}`}>{pin.contactEmail}</a>}
        </div>
      )}
      <div className="selected-pin-sheet__actions">
        <button type="button" className="btn btn--primary" onClick={onUpdateOutcome}>Update outcome</button>
        <button type="button" className="btn btn--secondary" onClick={onEdit}>Edit details</button>
        <button type="button" className="btn btn--ghost selected-pin-sheet__delete" onClick={onDelete}>Delete pin</button>
      </div>
    </aside>
  )
}
