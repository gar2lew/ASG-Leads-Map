import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useCurrentUser } from '../auth'
import { createLeadRegisterRepository } from '../domain/leadRegisterRepository'
import { filterLeadRecords, migrateLeadRecord, type LeadFilters, type LeadRecord } from '../domain/leadRegister'
import { CallCentreSummary } from './call-centre/CallCentreSummary'
import { LeadRegister } from './call-centre/LeadRegister'
import { QuickCapturePanel, type CaptureMode } from './call-centre/QuickCapturePanel'
import './CallLogPage.css'
import './call-centre/CallCentreWorkspace.css'

const repository = createLeadRegisterRepository()

export function CallLogPage() {
  const user = useCurrentUser()
  const [records, setRecords] = useState<LeadRecord[]>([])
  const [mode, setMode] = useState<CaptureMode>('lead')
  const [draft, setDraft] = useState(() => migrateLeadRecord({ id: crypto.randomUUID(), repName: user.displayName || user.email }))
  const [filters, setFilters] = useState<LeadFilters>({ status: 'all', rep: 'all', timely: 'all', office: 'all' })
  const [importMessage, setImportMessage] = useState('')

  useEffect(() => { void repository.loadLeadRecords().then(setRecords) }, [])
  const visible = useMemo(() => filterLeadRecords(records, filters, new Date().toISOString().slice(0, 10)), [records, filters])

  function updateDraft(key: keyof LeadRecord, value: string | boolean) { setDraft((current) => ({ ...current, [key]: value })) }

  async function saveCapture(next: LeadRecord, captureMode: CaptureMode) {
    if (captureMode === 'lead') {
      setRecords(await repository.saveLeadRecords([...records, next]))
    } else {
      const existing = records.find((record) => record.id === next.id || (next.address && record.address.toLowerCase() === next.address.toLowerCase()))
      if (existing) {
        const activity = { id: crypto.randomUUID(), leadId: existing.id, kind: captureMode, occurredAt: next.callTimestamp, repName: next.repName || user.displayName || user.email, outcome: next.callResult, notes: next.notes, followUpDate: next.followUpDate }
        setRecords(await repository.addLeadActivity(existing.id, activity))
      } else setRecords(await repository.saveLeadRecords([...records, next]))
    }
    setDraft(migrateLeadRecord({ id: crypto.randomUUID(), repName: user.displayName || user.email }))
  }

  async function toggleTimely(record: LeadRecord, sent: boolean) {
    if (!sent && !window.confirm('Remove the Timely CRM handoff marker?')) return
    setRecords(await repository.setTimelyHandoff(record.id, sent, user.displayName || user.email))
  }

  function selectActivity(record: LeadRecord) {
    setDraft({ ...record, id: crypto.randomUUID(), callTimestamp: new Date().toISOString().slice(0, 16) })
    setMode('call'); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const result = await repository.importLeadCsv(await file.text())
    setRecords(await repository.loadLeadRecords())
    setImportMessage(`${result.records.length} leads imported${result.skipped ? `, ${result.skipped} skipped` : ''}.`)
    event.target.value = ''
  }

  function exportCsv() {
    const blob = new Blob([repository.exportLeadCsv(visible)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'asg-call-centre-register.csv'; link.click(); URL.revokeObjectURL(url)
  }

  return <div className="page call-log-page call-centre-workspace">
    <header className="page__header call-centre-command"><div><p className="page__eyebrow">FIELD ACTIVITY REGISTER</p><h1 className="page__title">Call centre</h1><p className="page__subtitle">Capture, qualify, and prepare field leads before they enter Timely CRM.</p></div><div className="call-centre-command__actions"><label className="btn btn--secondary">Import register<input type="file" accept=".csv" onChange={importCsv} /></label><button className="btn btn--secondary" type="button" onClick={exportCsv}>Export view</button></div></header>
    {importMessage && <p className="call-centre-import-status" role="status">{importMessage}</p>}
    <CallCentreSummary records={visible} />
    <QuickCapturePanel mode={mode} draft={draft} onChange={updateDraft} onSubmit={saveCapture} onModeChange={setMode} />
    <LeadRegister records={visible} filters={filters} onFiltersChange={setFilters} onAddActivity={selectActivity} onToggleTimely={toggleTimely} />
  </div>
}
