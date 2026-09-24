import type { LeadRecord } from '../../domain/leadRegister'

export function LeadCard({ record, onAddActivity, onToggleTimely }: { record: LeadRecord; onAddActivity: () => void; onToggleTimely: (sent: boolean) => void }) {
  const latest = record.activities[record.activities.length - 1]
  return <article className="lead-card">
    <div className="lead-card__header"><div><span className="lead-card__initials">{(record.leadName || 'Lead').slice(0, 2).toUpperCase()}</span><div><h3>{record.leadName || 'Unnamed lead'}</h3><p>{record.address || 'Address not added'}</p></div></div><span className={`lead-chip lead-chip--${record.qualification}`}>{record.qualification.replace('_', ' ')}</span></div>
    <div className="lead-card__meta"><span>{record.renterOwner || 'Owner'} · {record.superannuation || 'Bracket not set'}</span><span>{latest ? `${latest.kind === 'door_knock' ? 'Knock' : 'Call'} · ${latest.outcome}` : 'No activity yet'}</span></div>
    <div className="lead-card__footer"><span>{record.followUpDate ? `Follow-up ${record.followUpDate}` : `Rep ${record.repName || 'unassigned'}`}</span><label className={record.timelySynced ? 'is-synced' : ''}><input type="checkbox" checked={record.timelySynced} onChange={(event) => onToggleTimely(event.target.checked)} /> {record.timelySynced ? 'Sent to Timely' : 'Timely CRM'}</label><button type="button" onClick={onAddActivity}>＋ Activity</button></div>
  </article>
}
