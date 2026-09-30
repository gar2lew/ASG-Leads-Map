import type { LeadRecord } from '../../domain/leadRegister'
import { countCallsToday, filterCallerQueue, type CallQueueView } from '../../domain/callQueue'

const queues: Array<{ view: CallQueueView; label: string }> = [
  { view: 'all', label: 'All leads' },
  { view: 'callbacks', label: 'Callbacks due' },
  { view: 'new', label: 'New · unworked' },
  { view: 'qualified', label: 'Qualified' },
  { view: 'timely-ready', label: 'Timely ready' },
]

export function CallCentreSummary({ records, queueView, onQueueViewChange }: { records: LeadRecord[]; queueView: CallQueueView; onQueueViewChange: (view: CallQueueView) => void }) {
  const now = new Date()
  const calls = countCallsToday(records, now)
  const knocks = records.reduce((total, record) => total + record.activities.filter((activity) => activity.kind === 'door_knock').length, 0)
  return <section className="call-centre-summary" aria-label="Call centre work queues">
    <div className="call-centre-summary__queues" role="group" aria-label="Choose lead queue">{queues.map(({ view, label }) => <button className={queueView === view ? 'is-active' : ''} type="button" key={view} aria-pressed={queueView === view} onClick={() => onQueueViewChange(view)}><span>{label}</span><strong>{filterCallerQueue(records, view, now).length}</strong></button>)}</div>
    <div className="call-centre-summary__activity" aria-label="Today's activity"><span><strong>{calls}</strong> calls today</span><span><strong>{knocks}</strong> door knocks logged</span></div>
  </section>
}
