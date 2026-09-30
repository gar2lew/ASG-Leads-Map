import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { canManageIntegrations, useCurrentUser } from '../auth'
import { createLeadRegisterRepository, parseLeadCsv } from '../domain/leadRegisterRepository'
import { createFirestoreLeadRegisterRepository } from '../domain/firestoreLeadRegisterRepository'
import { filterLeadRecords, migrateLeadRecord, type LeadFilters, type LeadOffice, type LeadRecord } from '../domain/leadRegister'
import { CallCentreSummary } from './call-centre/CallCentreSummary'
import { LeadRegister } from './call-centre/LeadRegister'
import { QuickCapturePanel, type CaptureMode } from './call-centre/QuickCapturePanel'
import './CallLogPage.css'
import './call-centre/CallCentreWorkspace.css'
import { syncSheetNow } from '../integrations/sheetSync'
import { googleSheetSources } from '../integrations/googleSheets'
import { getFirestoreDb } from '../firebase/firestore'
import { isFirebaseConfigured } from '../firebase/config'
import { filterCallerQueue, type CallQueueView } from '../domain/callQueue'
import { LeadDetailPanel } from './call-centre/LeadDetailPanel'

function isOffice(value: unknown): value is LeadOffice { return value === 'perth' || value === 'brisbane' }

export function CallLogPage() {
  const user = useCurrentUser()
  const repository = useMemo(() => isFirebaseConfigured() ? createFirestoreLeadRegisterRepository(getFirestoreDb(), user) : null, [user])
  const localRepository = useMemo(() => createLeadRegisterRepository(), [])
  const [records, setRecords] = useState<LeadRecord[]>([])
  const [mode, setMode] = useState<CaptureMode>('lead')
  const [draft, setDraft] = useState(() => migrateLeadRecord({ id: crypto.randomUUID(), repName: user.displayName || user.email }))
  const [filters, setFilters] = useState<LeadFilters>({ status: 'all', rep: 'all', timely: 'all', office: 'all' })
  const [queueView, setQueueView] = useState<CallQueueView>('all')
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null)
  const [captureOpen, setCaptureOpen] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [sheetImporting, setSheetImporting] = useState<LeadOffice | null>(null)

  useEffect(() => {
    if (!repository) {
      void localRepository.loadLeadRecords().then(setRecords)
      return
    }
    return repository.subscribeLeadRecords(setRecords, (error) => setImportMessage(error.message))
  }, [localRepository, repository])
  const visible = useMemo(() => filterLeadRecords(records, filters, new Date().toISOString().slice(0, 10)), [records, filters])
  const queueRecords = useMemo(() => filterCallerQueue(visible, queueView), [visible, queueView])
  const selectedRecord = queueRecords.find((record) => record.id === selectedRecordId) ?? queueRecords[0] ?? null
  const selectedIndex = selectedRecord ? queueRecords.findIndex((record) => record.id === selectedRecord.id) : -1

  function updateDraft(key: keyof LeadRecord, value: string | boolean) { setDraft((current) => ({ ...current, [key]: value })) }

  function activityFromCapture(next: LeadRecord, captureMode: Exclude<CaptureMode, 'lead'>) {
    return { id: crypto.randomUUID(), leadId: next.id, kind: captureMode, occurredAt: next.callTimestamp, repName: next.repName || user.displayName || user.email, outcome: next.callResult, notes: next.notes, followUpDate: next.followUpDate }
  }

  async function saveCapture(next: LeadRecord, captureMode: CaptureMode) {
    try {
      if (!repository) {
        let saved: LeadRecord[]
        if (captureMode === 'lead') {
          saved = await localRepository.saveLeadRecords([...records, { ...next, office: next.office ?? user.officeId }])
        } else if (records.some((record) => record.id === next.id)) {
          saved = await localRepository.addLeadActivity(next.id, activityFromCapture(next, captureMode))
        } else {
          await localRepository.saveLeadRecords([...records, { ...next, office: next.office ?? user.officeId }])
          saved = await localRepository.addLeadActivity(next.id, activityFromCapture(next, captureMode))
        }
        setRecords(saved)
      } else if (captureMode === 'lead') {
        await repository.saveLeadRecord({ ...next, office: next.office ?? user.officeId })
      } else {
        const existing = records.find((record) => record.id === next.id)
        if (existing) {
          await repository.addLeadActivity(existing.id, activityFromCapture(next, captureMode))
        } else {
          await repository.saveLeadRecord({ ...next, office: next.office ?? user.officeId })
          await repository.addLeadActivity(next.id, activityFromCapture(next, captureMode))
        }
      }
      if (repository && next.timelySynced) await repository.setTimelyHandoff(next.id, true, user.displayName || user.email)
      setDraft(migrateLeadRecord({ id: crypto.randomUUID(), repName: user.displayName || user.email, office: user.officeId }))
      setCaptureOpen(false)
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Unable to save this lead activity.')
    }
  }

  async function toggleTimely(record: LeadRecord, sent: boolean) {
    if (!sent && !window.confirm('Remove the Timely CRM handoff marker?')) return
    try {
      if (!repository) setRecords(await localRepository.setTimelyHandoff(record.id, sent, user.displayName || user.email))
      else await repository.setTimelyHandoff(record.id, sent, user.displayName || user.email)
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Unable to update the Timely CRM status.')
    }
  }

  function selectActivity(record: LeadRecord, captureMode: CaptureMode = 'call') {
    setDraft({ ...record, id: record.id, callTimestamp: new Date().toISOString().slice(0, 16) })
    setMode(captureMode); setSelectedRecordId(record.id); setCaptureOpen(true); window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openCapture(captureMode: CaptureMode) {
    setMode(captureMode)
    setDraft(migrateLeadRecord({ id: crypto.randomUUID(), repName: user.displayName || user.email, office: user.officeId }))
    setCaptureOpen(true)
  }

  function moveSelection(offset: number) {
    if (selectedIndex < 0 || queueRecords.length < 2) return
    const next = (selectedIndex + offset + queueRecords.length) % queueRecords.length
    const record = queueRecords[next]
    if (record) setSelectedRecordId(record.id)
  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const csvText = await file.text()
      const result = parseLeadCsv(csvText, user.officeId)
      if (!repository) {
        const localResult = await localRepository.importLeadCsv(csvText, user.officeId)
        setRecords(await localRepository.loadLeadRecords())
        setImportMessage(`${localResult.records.length} leads imported${localResult.skipped ? `, ${localResult.skipped} skipped` : ''}.`)
        event.target.value = ''
        return
      }
      let imported = 0
      const batchRecords = [...records]
      for (const row of result.records) {
        const office = row.office ?? user.officeId
        if (!isOffice(office)) throw new Error('Choose a Perth or Brisbane office before importing leads.')
        const match = batchRecords.find((existing) => existing.office === office && (
          (row.leadId && existing.leadId.toLocaleLowerCase('en-AU') === row.leadId.toLocaleLowerCase('en-AU')) ||
          (row.address.trim() && row.leadName.trim() && existing.address.trim().toLocaleLowerCase('en-AU') === row.address.trim().toLocaleLowerCase('en-AU') && existing.leadName.trim().toLocaleLowerCase('en-AU') === row.leadName.trim().toLocaleLowerCase('en-AU'))
        ))
        const saved = await repository.saveLeadRecord(match
          ? { ...match, ...row, id: match.id, office, pinId: match.pinId, pinIds: match.pinIds, latitude: match.latitude, longitude: match.longitude, pinOutcome: match.pinOutcome, activities: match.activities, source: match.source, timelySynced: match.timelySynced, timelySyncedAt: match.timelySyncedAt, timelySyncedBy: match.timelySyncedBy }
          : { ...row, office })
        const savedIndex = batchRecords.findIndex((existing) => existing.id === saved.id)
        if (savedIndex >= 0) batchRecords[savedIndex] = saved
        else batchRecords.unshift(saved)
        imported++
      }
      setImportMessage(`${imported} leads imported${result.skipped ? `, ${result.skipped} skipped` : ''}.`)
      event.target.value = ''
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Unable to import this register.')
    }
  }

  async function syncGoogleSheet(office: LeadOffice) {
    const source = googleSheetSources.find((item) => item.office === office)
    if (!source) return
    setSheetImporting(office)
    setImportMessage('')
    try {
      if (!repository) throw new Error('Live Google Sheets sync requires Firebase sign-in.')
      const result = await syncSheetNow(office)
      setImportMessage(`${office} register synced: ${result.summary.inserted} added, ${result.summary.updated} updated, ${result.summary.unchanged} unchanged.`)
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Unable to import the Google Sheet.')
    } finally { setSheetImporting(null) }
  }

  function exportCsv() {
    const repository = createLeadRegisterRepository()
    const blob = new Blob([repository.exportLeadCsv(visible)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'asg-call-centre-register.csv'; link.click(); URL.revokeObjectURL(url)
  }

  return <div className="page call-log-page call-centre-workspace">
    <header className="page__header call-centre-command"><div><p className="page__eyebrow">FIELD ACTIVITY REGISTER</p><h1 className="page__title">Call centre</h1><p className="page__subtitle">Capture, qualify, and prepare field leads before they enter Timely CRM.</p></div><div className="call-centre-command__actions"><label className="btn btn--secondary">Import register<input type="file" accept=".csv" onChange={importCsv} /></label><button className="btn btn--secondary" type="button" onClick={exportCsv}>Export view</button></div></header>
    <div className="call-centre-sheet-links" aria-label="Google Sheets sources">
      <span>Live registers</span>
      {googleSheetSources.map((source) => <span key={source.office} className="call-centre-sheet-link">{repository && canManageIntegrations(user.role) && (user.role === 'super_admin' || user.officeId === source.office) && <button className="btn btn--secondary" type="button" onClick={() => void syncGoogleSheet(source.office)} disabled={sheetImporting !== null}>{sheetImporting === source.office ? 'Syncing…' : `Sync ${source.office}`}</button>}<a href={source.url} target="_blank" rel="noreferrer">Open sheet</a></span>)}
    </div>
    {importMessage && <p className="call-centre-import-status" role="status">{importMessage}</p>}
    <CallCentreSummary records={visible} queueView={queueView} onQueueViewChange={setQueueView} />
    <div className="call-centre-quick-actions" role="group" aria-label="Quick capture actions">
      <span>Quick capture</span>
      <button className="btn btn--secondary" type="button" onClick={() => openCapture('lead')}>＋ Add lead</button>
      <button className="btn btn--secondary" type="button" onClick={() => openCapture('call')}>☎ Log call</button>
      <button className="btn btn--secondary" type="button" onClick={() => openCapture('door_knock')}>⌂ Log door knock</button>
    </div>
    <QuickCapturePanel mode={mode} draft={draft} onChange={updateDraft} onSubmit={saveCapture} onModeChange={setMode} isOpen={captureOpen} onToggle={() => setCaptureOpen((open) => !open)} />
    <div className="call-centre-workspace__body">
      <LeadRegister records={visible} filters={filters} onFiltersChange={setFilters} onAddActivity={selectActivity} onToggleTimely={toggleTimely} selectedRecordId={selectedRecord?.id ?? null} onSelectRecord={(record) => setSelectedRecordId(record.id)} queueView={queueView} />
      {selectedRecord ? <LeadDetailPanel record={selectedRecord} onAddActivity={(captureMode) => selectActivity(selectedRecord, captureMode)} onToggleTimely={(sent) => void toggleTimely(selectedRecord, sent)} onPrevious={() => moveSelection(-1)} onNext={() => moveSelection(1)} canPrevious={queueRecords.length > 1} canNext={queueRecords.length > 1} /> : <section className="call-centre-detail-empty"><h2>Select a lead to work</h2><p>Choose a lead from the queue or add a new one to start.</p></section>}
    </div>
  </div>
}
