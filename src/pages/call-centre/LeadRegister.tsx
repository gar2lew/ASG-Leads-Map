import type { LeadFilters, LeadRecord } from '../../domain/leadRegister'
import type { CaptureMode } from './QuickCapturePanel'
import { LeadCard } from './LeadCard'

interface Props {
  records: LeadRecord[]
  filters: LeadFilters
  onFiltersChange: (filters: LeadFilters) => void
  onAddActivity: (record: LeadRecord, mode?: CaptureMode) => void
  onToggleTimely: (record: LeadRecord, sent: boolean) => void
}

export function LeadRegister({ records, filters, onFiltersChange, onAddActivity, onToggleTimely }: Props) {
  const reps = [...new Set(records.map((record) => record.repName).filter(Boolean))]
  return <section className="call-centre-register" aria-labelledby="register-heading">
    <div className="call-centre-register__header"><div><p className="call-centre-kicker">WORK QUEUE</p><h2 id="register-heading">Lead register <span>{records.length}</span></h2></div><div className="call-centre-register__filters"><input aria-label="Search leads" value={filters.query || ''} onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })} placeholder="Search lead, address, phone…" /><select aria-label="Filter status" value={filters.status || 'all'} onChange={(event) => onFiltersChange({ ...filters, status: event.target.value })}><option value="all">All statuses</option><option>New</option><option>Lead</option><option>Qualified</option><option>Appointment Set</option><option>Not Interested</option></select><select aria-label="Filter rep" value={filters.rep || 'all'} onChange={(event) => onFiltersChange({ ...filters, rep: event.target.value })}><option value="all">All reps</option>{reps.map((rep) => <option key={rep}>{rep}</option>)}</select><select aria-label="Filter Timely" value={filters.timely || 'all'} onChange={(event) => onFiltersChange({ ...filters, timely: event.target.value as LeadFilters['timely'] })}><option value="all">All CRM states</option><option value="pending">Pending Timely</option><option value="sent">Sent to Timely</option></select></div></div>
    <div className="call-centre-register__list">{records.length ? records.map((record) => <LeadCard key={record.id} record={record} onAddActivity={(mode) => onAddActivity(record, mode)} onToggleTimely={(sent) => onToggleTimely(record, sent)} />) : <p className="call-centre-empty">No leads match these filters. Add a lead or import a register to begin.</p>}</div>
  </section>
}
