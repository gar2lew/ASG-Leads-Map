import type { LeadRecord } from '../../domain/leadRegister'
import { phoneHref } from '../../domain/callQueue'
import type { CaptureMode } from './QuickCapturePanel'
import './LeadDetailPanel.css'

interface Props {
  record: LeadRecord
  onAddActivity: (mode: Extract<CaptureMode, 'call' | 'door_knock'>) => void
  onToggleTimely: (sent: boolean) => void
  onPrevious: () => void
  onNext: () => void
  canPrevious?: boolean
  canNext?: boolean
}

function formatFollowUp(value?: string) {
  if (!value) return 'No follow-up scheduled'
  const date = new Date(`${value}T12:00:00`)
  return `Follow-up · ${new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Australia/Perth' }).format(date)}`
}

function formatActivityDate(value: string, office: LeadRecord['office']) {
  const localOfficeTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (localOfficeTime && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const [, year, month, day, hour, minute] = localOfficeTime
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12))
    const dayAndMonth = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)
    const hourNumber = Number(hour)
    const localHour = hourNumber % 12 || 12
    return `${dayAndMonth} · ${localHour}:${minute} ${hourNumber < 12 ? 'am' : 'pm'}`
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const timezone = office === 'brisbane' ? 'Australia/Brisbane' : 'Australia/Perth'
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(date)
}

export function LeadDetailPanel({ record, onAddActivity, onToggleTimely, onPrevious, onNext, canPrevious = true, canNext = true }: Props) {
  const callLink = phoneHref(record.phone)
  const activities = [...record.activities].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  const mapUrl = `/map?leadId=${encodeURIComponent(record.id)}`
  const needsLocationReview = record.latitude == null || record.longitude == null

  return <section className="call-lead-detail" aria-labelledby="selected-lead-heading">
    <div className="call-lead-detail__heading">
      <div><p className="call-centre-kicker">SELECTED LEAD</p><h2 id="selected-lead-heading">{record.leadName || 'Unnamed lead'}</h2><p>{record.address || 'Address not added'}</p></div>
      <span className={`lead-chip lead-chip--${record.qualification}`}>{record.qualification.replace('_', ' ')}</span>
    </div>

    <div className="call-lead-detail__contact">
      <div><span>Contact</span><strong>{record.phone || 'No number recorded'}</strong></div>
      <div><span>Assigned rep</span><strong>{record.repName || 'Unassigned'}</strong></div>
      <div><span>Office</span><strong>{record.office === 'brisbane' ? 'Brisbane' : record.office === 'perth' ? 'Perth' : 'Unassigned'}</strong></div>
      <div><span>Follow-up</span><strong>{formatFollowUp(record.followUpDate).replace('Follow-up · ', '')}</strong></div>
    </div>

    {needsLocationReview && <p className="call-lead-detail__location" role="status">Location needs review · confirm the property on the map.</p>}
    <div className="call-lead-detail__actions" aria-label="Lead actions">
      {callLink && <a className="btn btn--primary" href={callLink} aria-label={`Call ${record.leadName || 'lead'}`}>Call lead</a>}
      <button className="btn btn--secondary" type="button" onClick={() => onAddActivity('call')}>Log call</button>
      <button className="btn btn--secondary" type="button" onClick={() => onAddActivity('door_knock')}>Log knock</button>
      <a className="btn btn--secondary" href={mapUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${record.leadName || 'lead'} on map`}>Open map ↗</a>
    </div>

    <div className="call-lead-detail__handoff">
      <div><strong>Timely CRM</strong><p>{record.timelySynced ? `Marked sent${record.timelySyncedBy ? ` by ${record.timelySyncedBy}` : ''}.` : 'Mark only after you have entered this lead in Timely.'}</p></div>
      <label><input type="checkbox" aria-label="Sent to Timely CRM" checked={record.timelySynced} onChange={(event) => onToggleTimely(event.target.checked)} /> {record.timelySynced ? 'Sent' : 'Mark sent'}</label>
    </div>

    <div className="call-lead-detail__timeline">
      <div className="call-lead-detail__section-heading"><div><p className="call-centre-kicker">HISTORY</p><h3>Activity timeline</h3></div><span>{activities.length} {activities.length === 1 ? 'entry' : 'entries'}</span></div>
      {activities.length ? <ol>{activities.map((activity) => <li key={activity.id}><span className="call-lead-detail__timeline-dot" /><div><div className="call-lead-detail__activity-title"><strong>{activity.kind === 'call' ? 'Call' : 'Door knock'} · {activity.outcome || 'Outcome not set'}</strong><time dateTime={activity.occurredAt}>{formatActivityDate(activity.occurredAt, record.office)}</time></div><p>{activity.notes || 'No notes recorded'}</p><small>{activity.repName || 'Rep not recorded'}{activity.followUpDate ? ` · ${formatFollowUp(activity.followUpDate)}` : ''}</small></div></li>)}</ol> : <p className="call-lead-detail__empty">No activity yet. Log the first call or knock to start the history.</p>}
    </div>

    <nav className="call-lead-detail__queue-nav" aria-label="Lead queue navigation">
      <button className="btn btn--secondary" type="button" onClick={onPrevious} disabled={!canPrevious} aria-label="Previous lead">← Previous</button>
      <button className="btn btn--secondary" type="button" onClick={onNext} disabled={!canNext} aria-label="Next lead">Next →</button>
    </nav>
  </section>
}
