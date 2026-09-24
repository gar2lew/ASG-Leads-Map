import { useState, type FormEvent } from 'react'
import type { LeadActivityKind, LeadRecord } from '../../domain/leadRegister'

export type CaptureMode = 'lead' | 'call' | 'door_knock'

interface Props {
  mode: CaptureMode
  draft: LeadRecord
  onChange: (key: keyof LeadRecord, value: string | boolean) => void
  onSubmit: (draft: LeadRecord, mode: CaptureMode) => void
  onModeChange: (mode: CaptureMode) => void
}

const outcomes: Record<CaptureMode, string[]> = {
  lead: [],
  call: ['Connected', 'No Answer', 'Voicemail', 'Not Interested', 'Follow-up'],
  door_knock: ['Knocked', 'No Answer', 'Not Interested', 'Lead Qualified', 'Appointment Set'],
}

export function QuickCapturePanel({ mode, draft, onChange, onSubmit, onModeChange }: Props) {
  const [error, setError] = useState('')
  const label = mode === 'lead' ? 'Add lead' : mode === 'call' ? 'Log call' : 'Log door knock'
  const activityKind: LeadActivityKind | undefined = mode === 'lead' ? undefined : mode

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!draft.leadName.trim() && !draft.address.trim()) {
      setError('Enter a lead name or property address before saving.')
      return
    }
    setError('')
    onSubmit({ ...draft, callResult: activityKind ? draft.callResult : '' }, mode)
  }

  return <section className="call-centre-capture" aria-labelledby="capture-heading">
    <div className="call-centre-capture__topline">
      <div><p className="call-centre-kicker">FAST CAPTURE</p><h2 id="capture-heading">{label}</h2><p>Keep the field register clean before Timely CRM.</p></div>
      <span className="call-centre-capture__badge">{mode === 'door_knock' ? 'FIELD' : mode === 'call' ? 'PHONE' : 'LEAD'}</span>
    </div>
    <div className="call-centre-capture__modes" role="tablist" aria-label="Capture type">
      <button type="button" className={mode === 'lead' ? 'is-active' : ''} onClick={() => onModeChange('lead')}>＋ Add lead</button>
      <button type="button" className={mode === 'call' ? 'is-active' : ''} onClick={() => onModeChange('call')}>☎ Log call</button>
      <button type="button" className={mode === 'door_knock' ? 'is-active' : ''} onClick={() => onModeChange('door_knock')}>⌂ Log door knock</button>
    </div>
    <form onSubmit={submit} className="call-centre-capture__form">
      <label>Lead name<input value={draft.leadName} onChange={(event) => onChange('leadName', event.target.value)} placeholder="e.g. David Campbell" /></label>
      <label>Property address<input value={draft.address} onChange={(event) => onChange('address', event.target.value)} placeholder="e.g. 124 Riverview Terrace" /></label>
      <label>Contact number<input value={draft.phone} onChange={(event) => onChange('phone', event.target.value)} placeholder="+61 4xx xxx xxx" /></label>
      <label>Rep<select value={draft.repName} onChange={(event) => onChange('repName', event.target.value)}><option value="">Assign later</option><option value={draft.repName}>{draft.repName || 'Current rep'}</option></select></label>
      {mode !== 'lead' && <label>Outcome<select value={draft.callResult} onChange={(event) => onChange('callResult', event.target.value)}><option value="">Select outcome</option>{outcomes[mode].map((outcome) => <option key={outcome}>{outcome}</option>)}</select></label>}
      <label>Qualification<select value={draft.qualification} onChange={(event) => onChange('qualification', event.target.value)}><option value="new">New</option><option value="qualified">Qualified</option><option value="callback">Callback</option><option value="not_interested">Not interested</option><option value="archived">Archived</option></select></label>
      <label>Follow-up date<input type="date" value={draft.followUpDate || ''} onChange={(event) => onChange('followUpDate', event.target.value)} /></label>
      <label className="call-centre-capture__wide">Field notes<textarea rows={3} value={draft.notes} onChange={(event) => onChange('notes', event.target.value)} placeholder="What happened? What is the next action?" /></label>
      <label className="call-centre-capture__check"><input type="checkbox" checked={draft.timelySynced} onChange={(event) => onChange('timelySynced', event.target.checked)} /> Sent to Timely CRM</label>
      {error && <p className="call-centre-capture__error" role="alert">{error}</p>}
      <button className="btn btn--primary call-centre-capture__submit" type="submit">Save {mode === 'lead' ? 'lead' : 'activity'} →</button>
    </form>
  </section>
}
