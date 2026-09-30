import type { LeadRecord } from '../domain/leadRegister'
import type { Pin } from '../domain'
import { pinOutcomeLabel } from '../domain'
import './SelectedPinSheet.css'

interface SelectedPinSheetProps {
  pin: Pin
  leadRecord?: LeadRecord | undefined
  onUpdateOutcome: () => void
  onEdit: () => void
  onDelete: () => void
  onClose: () => void
}

export function SelectedPinSheet({ pin, leadRecord, onUpdateOutcome, onEdit, onDelete, onClose }: SelectedPinSheetProps) {
  const hasContact = Boolean(pin.contactName || pin.contactPhone || pin.contactEmail)
  const latestActivity = leadRecord?.activities
    .slice()
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0]
  const qualificationLabel = leadRecord?.qualification.replaceAll('_', ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase())

  return (
    <aside className={`selected-pin-sheet surface--light property-details property-details--${pin.outcome}`} aria-label="Property details">
      <div className="property-details__accent" aria-hidden="true" />
      <div className="property-details__handle" aria-hidden="true" />
      <button
        type="button"
        className="property-details__close"
        onClick={onClose}
        aria-label="Close property details"
      >
        ×
      </button>
      <header className="property-details__header">
        <span className="property-details__outcome">
          {pinOutcomeLabel(pin.outcome)}
        </span>
        {qualificationLabel && <span className={`property-details__qualification property-details__qualification--${leadRecord?.qualification}`}>
          {qualificationLabel}
        </span>}
        <span className="property-details__eyebrow">Property details</span>
        <h2 className="property-details__address">{pin.address || 'Unknown property'}</h2>
        {leadRecord?.leadName && leadRecord.leadName !== pin.contactName && <p className="property-details__lead-name">{leadRecord.leadName}</p>}
      </header>
      {pin.pendingLeadActivity && <p className="property-details__sync-state" role="status">
        Activity sync pending <span>Saved on this device; retry with Sync when connected.</span>
      </p>}
      {latestActivity && (
        <section className="property-details__section property-details__latest-activity" aria-labelledby="latest-activity-heading">
          <h3 id="latest-activity-heading">Latest activity</h3>
          <div className="property-details__activity-heading">
            <strong>{latestActivity.outcome || (latestActivity.kind === 'call' ? 'Call logged' : 'Door knock logged')}</strong>
            <time dateTime={latestActivity.occurredAt}>{new Date(latestActivity.occurredAt).toLocaleDateString('en-AU')}</time>
          </div>
          <p>{latestActivity.notes || 'No notes recorded.'}</p>
          <span className="property-details__activity-rep">{latestActivity.repName}</span>
        </section>
      )}
      <section className="property-details__section" aria-labelledby="visit-details-heading">
        <h3 id="visit-details-heading">Visit details</h3>
        <dl className="property-details__facts">
          <div><dt>Recorded by</dt><dd>{pin.createdBy}</dd></div>
          <div><dt>Visit date</dt><dd>{new Date(pin.createdAt).toLocaleDateString('en-AU')}</dd></div>
          <div><dt>Last updated</dt><dd>{new Date(pin.updatedAt).toLocaleDateString('en-AU')}</dd></div>
        </dl>
      </section>
      {hasContact && (
        <section className="property-details__section property-details__contact" aria-labelledby="contact-details-heading">
          <h3 id="contact-details-heading">Contact</h3>
          {pin.contactName && <span>{pin.contactName}</span>}
          {pin.contactPhone && <a href={`tel:${pin.contactPhone}`}>{pin.contactPhone}</a>}
          {pin.contactEmail && <a href={`mailto:${pin.contactEmail}`}>{pin.contactEmail}</a>}
        </section>
      )}
      {pin.notes && (
        <section className="property-details__section" aria-labelledby="visit-notes-heading">
          <h3 id="visit-notes-heading">Visit notes</h3>
          <p>{pin.notes}</p>
        </section>
      )}
      <div className="property-details__actions">
        <button type="button" className="btn btn--primary" onClick={onUpdateOutcome}>Update outcome</button>
        <button type="button" className="btn btn--secondary" onClick={onEdit}>Edit details</button>
      </div>
      <button type="button" className="property-details__danger" onClick={onDelete}>Delete pin</button>
    </aside>
  )
}
