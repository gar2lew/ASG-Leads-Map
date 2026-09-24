import type { LeadRecord } from '../../domain/leadRegister'

export function CallCentreSummary({ records }: { records: LeadRecord[] }) {
  const today = new Date().toISOString().slice(0, 10)
  const metrics = [
    ['New leads', records.filter((record) => record.qualification === 'new').length, 'OPEN'],
    ['Calls today', records.filter((record) => record.callTimestamp.startsWith(today)).length, 'ACTIVITY'],
    ['Callbacks due', records.filter((record) => record.qualification === 'callback' && record.followUpDate && record.followUpDate <= today).length, 'FOLLOW-UP'],
    ['Door knocks', records.reduce((total, record) => total + record.activities.filter((activity) => activity.kind === 'door_knock').length, 0), 'FIELD'],
    ['Qualified', records.filter((record) => record.qualification === 'qualified').length, 'READY'],
    ['Timely ready', records.filter((record) => record.timelySynced).length, 'SYNCED'],
  ]
  return <div className="call-centre-summary" aria-label="Call centre summary">{metrics.map(([label, value, tone]) => <article className="call-centre-metric" key={label}><span>{tone}</span><strong>{value}</strong><p>{label}</p></article>)}</div>
}
