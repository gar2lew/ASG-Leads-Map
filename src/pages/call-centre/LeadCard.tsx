import type { LeadRecord } from '../../domain/leadRegister'
import type { CaptureMode } from './QuickCapturePanel'
import { phoneHref } from '../../domain/callQueue'

export function LeadCard({ record, onAddActivity, onToggleTimely, onSelect, selected = false }: { record: LeadRecord; onAddActivity: (mode?: CaptureMode) => void; onToggleTimely: (sent: boolean) => void; onSelect: () => void; selected?: boolean }) {
  const latest = record.activities[record.activities.length - 1]
  const callLink = phoneHref(record.phone)
  const mapUrl = `/map?leadId=${encodeURIComponent(record.id)}`
  const needsLocationReview = record.latitude == null || record.longitude == null
  return <article className={`lead-card${selected ? ' is-selected' : ''}`}>
    <div className="lead-card__header"><div><span className="lead-card__initials">{(record.leadName || 'Lead').slice(0, 2).toUpperCase()}</span><div><h3><button className="lead-card__select" type="button" aria-label={`Select ${record.leadName || 'lead'}`} aria-pressed={selected} onClick={onSelect}>{record.leadName || 'Unnamed lead'}</button></h3><p>{record.address || 'Address not added'}</p></div></div><div className="lead-card__badges">{needsLocationReview && <span className="lead-chip lead-chip--review">Location review</span>}<span className={`lead-chip lead-chip--${record.qualification}`}>{record.qualification.replace('_', ' ')}</span></div></div>
    <div className="lead-card__meta"><span>{record.renterOwner || 'Owner'} · {record.superannuation || 'Bracket not set'}</span><span>{latest ? `${latest.kind === 'door_knock' ? 'Knock' : 'Call'} · ${latest.outcome}` : 'No activity yet'}</span></div>
    <div className="lead-card__footer"><span>{record.followUpDate ? `Follow-up ${record.followUpDate}` : `Rep ${record.repName || 'unassigned'}`}</span><label className={record.timelySynced ? 'is-synced' : ''}><input aria-label="Timely CRM" type="checkbox" checked={record.timelySynced} onChange={(event) => onToggleTimely(event.target.checked)} /> {record.timelySynced ? 'Sent to Timely' : 'Timely CRM'}</label><div className="lead-card__actions">{callLink && <a href={callLink} aria-label={`Call ${record.leadName || 'lead'}`}>Call</a>}<a href={mapUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${record.leadName || 'lead'} on map`}>Map ↗</a><button type="button" onClick={() => onAddActivity('call')}>＋ Activity</button><button type="button" onClick={() => onAddActivity('door_knock')}>Log knock</button></div></div>
  </article>
}
