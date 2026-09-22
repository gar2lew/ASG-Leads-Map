import { useMemo, useState, type FormEvent } from 'react'
import { useCurrentUser } from '../auth'

type CallRecord = { id: string; contact: string; outcome: string; notes: string; followUp: string; createdAt: string; rep: string }
const STORAGE_KEY = 'asg-call-log'
const outcomes = ['Connected', 'Voicemail', 'No answer', 'Not interested', 'Follow-up required']

function readCalls(): CallRecord[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CallRecord[] } catch { return [] }
}

export function CallLogPage() {
  const user = useCurrentUser()
  const [calls, setCalls] = useState<CallRecord[]>(readCalls)
  const [contact, setContact] = useState('')
  const [outcome, setOutcome] = useState(outcomes[0])
  const [notes, setNotes] = useState('')
  const [followUp, setFollowUp] = useState('')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => calls.filter((call) => `${call.contact} ${call.outcome} ${call.notes}`.toLowerCase().includes(query.toLowerCase())), [calls, query])
  function submit(event: FormEvent) {
    event.preventDefault(); if (!contact.trim()) return
    const next = [{ id: crypto.randomUUID(), contact: contact.trim(), outcome: outcome || 'Connected', notes: notes.trim(), followUp, createdAt: new Date().toISOString(), rep: user.displayName ?? user.email }, ...calls]
    setCalls(next); localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setContact(''); setNotes(''); setFollowUp('')
  }
  return <div className="page"><header className="page__header"><div><p className="page__eyebrow">FIELD ACTIVITY</p><h1 className="page__title">Call log</h1><p className="page__subtitle">Capture conversations, outcomes and follow-ups in one place.</p></div></header><div className="card" style={{ marginBottom: '1rem' }}><div className="card__header"><h2 className="card__title">Log a call</h2></div><form className="card__content" onSubmit={submit} style={{ display: 'grid', gap: '0.8rem', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}><label>Contact or property<input className="form-input" value={contact} onChange={(e) => setContact(e.target.value)} required placeholder="e.g. 14 Stirling Hwy" /></label><label>Outcome<select className="form-input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>{outcomes.map((item) => <option key={item}>{item}</option>)}</select></label><label>Follow-up date<input className="form-input" type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></label><label style={{ gridColumn: '1 / -1' }}>Notes<textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was discussed?" /></label><button className="btn btn--primary" type="submit">Save call</button></form></div><section className="card"><div className="card__header"><h2 className="card__title">Recent calls <span className="badge">{filtered.length}</span></h2><input className="form-input" style={{ maxWidth: 260 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search calls…" /></div><div className="card__content">{filtered.length === 0 ? <p className="empty-state">No calls logged yet.</p> : <div style={{ display: 'grid', gap: '0.75rem' }}>{filtered.map((call) => <article key={call.id} className="card" style={{ padding: '1rem' }}><strong>{call.contact}</strong><span style={{ marginLeft: '1rem' }}>{call.outcome}</span><p>{call.notes || 'No notes added.'}</p><small>{new Date(call.createdAt).toLocaleString()} · {call.rep}{call.followUp ? ` · Follow up ${call.followUp}` : ''}</small></article>)}</div>}</div></section></div>
}
