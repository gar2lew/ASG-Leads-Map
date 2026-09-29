import { useEffect, useState, type ChangeEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../auth'
import { canManageUsers } from '../domain/roles'
import { getAllPins, ingestLead, parseLeadWorkbook, findImportedDuplicates, type LeadImportPreview } from '../domain'
import type { OfficeId } from '../domain/roles'
import { confirmSheetBaseline, getSheetSyncStatus, previewSheetBaseline, resolveSheetConflict, syncSheetNow, type SheetSyncError, type SheetSyncIssue, type SheetSyncPreview, type SheetSyncStatus } from '../integrations/sheetSync'
import type { LeadSourceField } from '../domain/leadRegister'
import { googleSheetSources } from '../domain/googleSheetSources'
import './LeadImportPage.css'

interface ImportDiagnostic {
  sheet: string
  row: number
  reason: string
}

export function LeadImportPage() {
  const user = useCurrentUser()
  const [officeId, setOfficeId] = useState<OfficeId>(user.officeId ?? 'perth')
  const [preview, setPreview] = useState<LeadImportPreview | null>(null)
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, created: 0, skipped: 0 })
  const [importComplete, setImportComplete] = useState(false)
  const [importDiagnostics, setImportDiagnostics] = useState<ImportDiagnostic[]>([])
  const [syncStatus, setSyncStatus] = useState<SheetSyncStatus | null>(null)
  const [syncPreview, setSyncPreview] = useState<SheetSyncPreview | null>(null)
  const [syncConflicts, setSyncConflicts] = useState<SheetSyncStatus['conflicts']>([])
  const [syncError, setSyncError] = useState<SheetSyncError | Error | null>(null)
  const [syncAction, setSyncAction] = useState<'preview' | 'confirm' | 'sync' | 'resolve' | null>(null)

  useEffect(() => {
    let active = true
    void getSheetSyncStatus(officeId).then((status) => {
      if (!active) return
      setSyncStatus(status)
      setSyncConflicts(status.conflicts)
    }).catch((cause: unknown) => {
      if (active) setSyncError(cause instanceof Error ? cause : new Error('Unable to load live register status.'))
    })
    return () => { active = false }
  }, [officeId])

  if (!canManageUsers(user.role)) return <Navigate to="/map" replace />

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setPreview(null)
    setImportComplete(false)
    setImportDiagnostics([])
    setFileName(file.name)
    setIsReading(true)
    try {
      const parsed = parseLeadWorkbook(await file.arrayBuffer(), officeId)
      const existing = await getAllPins()
      const duplicates = findImportedDuplicates(parsed.records, existing)
      setPreview(parsed)
      setDuplicateCount(duplicates.size)
      setImportDiagnostics([
        ...parsed.invalidRows,
        ...parsed.records
          .filter((record) => duplicates.has(record.dedupeKey))
          .map((record) => ({
            sheet: record.sourceSheet,
            row: record.sourceRow,
            reason: 'Already exists on the map',
          })),
      ])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read this workbook.')
    } finally {
      setIsReading(false)
    }
  }

  async function handleImport() {
    if (!preview || isImporting) return
    setIsImporting(true)
    setImportComplete(false)
    try {
      const existing = await getAllPins()
      const duplicates = findImportedDuplicates(preview.records, existing)
      const records = preview.records.filter((record) => !duplicates.has(record.dedupeKey))
      const diagnostics: ImportDiagnostic[] = [
        ...preview.invalidRows,
        ...preview.records
          .filter((record) => duplicates.has(record.dedupeKey))
          .map((record) => ({
            sheet: record.sourceSheet,
            row: record.sourceRow,
            reason: 'Already exists on the map',
          })),
      ]
      let skipped = preview.records.length - records.length
      let created = 0
      setImportDiagnostics(diagnostics)
      setImportProgress({ done: 0, total: records.length, created, skipped })
      for (let index = 0; index < records.length; index += 1) {
        const record = records[index]
        if (!record) continue
        const result = await ingestLead({
          address: record.address,
          notes: [record.notes, `Imported from ${record.sourceSheet} (${record.sourceStatus})`].filter(Boolean).join(' · '),
          officeId,
          source: 'jotform',
          outcome: record.outcome,
          ...(record.contactName ? { contactName: record.contactName } : {}),
          ...(record.contactPhone ? { contactPhone: record.contactPhone } : {}),
          ...(record.leadId ? { externalId: record.leadId } : {}),
        }, user.uid)
        if (result.status === 'created') {
          created += 1
        } else {
          skipped += 1
          diagnostics.push({
            sheet: record.sourceSheet,
            row: record.sourceRow,
            reason: result.reason ?? (result.status === 'duplicate'
              ? 'Already exists on the map'
              : result.status === 'geocoding-failed'
                ? 'Address could not be geocoded'
                : 'Invalid lead'),
          })
          setImportDiagnostics([...diagnostics])
        }
        setImportProgress({ done: index + 1, total: records.length, created, skipped })
        await new Promise((resolve) => window.setTimeout(resolve, 1100))
      }
      setImportComplete(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import stopped unexpectedly. Refresh and retry to continue.')
    } finally {
      setIsImporting(false)
    }
  }

  function handleOfficeChange(value: OfficeId) {
    setOfficeId(value)
    setSyncStatus(null)
    setSyncConflicts([])
    setPreview(null)
    setFileName('')
    setImportDiagnostics([])
    setSyncPreview(null)
    setSyncError(null)
  }

  async function handlePreviewBaseline() {
    setSyncAction('preview')
    setSyncError(null)
    setSyncPreview(null)
    try {
      const result = await previewSheetBaseline(officeId)
      setSyncPreview(result)
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause : new Error('Unable to preview the live register.'))
    } finally {
      setSyncAction(null)
    }
  }

  async function handleConfirmBaseline() {
    if (!syncPreview || syncPreview.invalidRows.length || syncAction) return
    setSyncAction('confirm')
    setSyncError(null)
    try {
      const result = await confirmSheetBaseline(officeId, syncPreview.previewId)
      setSyncPreview(null)
      setSyncConflicts(result.conflicts)
      const status = await getSheetSyncStatus(officeId)
      setSyncStatus(status)
      setSyncConflicts(status.conflicts)
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause : new Error('Unable to confirm the baseline.'))
    } finally {
      setSyncAction(null)
    }
  }

  async function handleSyncNow() {
    if (syncAction) return
    setSyncAction('sync')
    setSyncError(null)
    try {
      const result = await syncSheetNow(officeId)
      setSyncConflicts(result.conflicts)
      const status = await getSheetSyncStatus(officeId)
      setSyncStatus(status)
      setSyncConflicts(status.conflicts)
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause : new Error('Unable to sync the live register.'))
      void getSheetSyncStatus(officeId).then((status) => {
        setSyncStatus(status)
        setSyncConflicts(status.conflicts)
      }).catch(() => undefined)
    } finally {
      setSyncAction(null)
    }
  }

  async function handleResolveConflict(recordId: string, field: LeadSourceField, resolution: 'firestore' | 'sheets') {
    if (syncAction) return
    setSyncAction('resolve')
    setSyncError(null)
    try {
      await resolveSheetConflict({ office: officeId, recordId, field, resolution })
      const status = await getSheetSyncStatus(officeId)
      setSyncStatus(status)
      setSyncConflicts(status.conflicts)
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause : new Error('Unable to resolve the source conflict.'))
    } finally {
      setSyncAction(null)
    }
  }

  const availableOffices: OfficeId[] = user.role === 'super_admin' ? ['perth', 'brisbane'] : user.officeId ? [user.officeId] : ['perth']
  const source = googleSheetSources.find((item) => item.office === officeId)

  return (
    <section className="lead-import page-card">
      <header className="lead-import__header">
        <div>
          <p className="eyebrow">Administrator tools</p>
          <h1>Lead import & register sync</h1>
          <p>Review the live office register before it becomes shared Firestore lead data.</p>
        </div>
      </header>

      <section className="lead-import__sheets" aria-labelledby="lead-import-sheets-title">
        <div className="lead-import__sheets-heading">
          <div>
            <p className="eyebrow">Live Google Sheets</p>
            <h2 id="lead-import-sheets-title">{source?.label ?? 'Office lead register'}</h2>
            <p>One-time baseline review, followed by safe nightly refreshes.</p>
          </div>
          {source && <a className="btn btn--secondary" href={source.url} target="_blank" rel="noreferrer">Open source sheet ↗</a>}
        </div>

        {syncStatus ? (
          <div className="lead-import__sync-status" role="status">
            <span className={`lead-import__sync-dot${syncStatus.lastSyncStatus === 'failed' ? ' is-error' : syncStatus.baselineConfirmed ? ' is-ready' : ''}`} />
            <span>{syncStatus.baselineConfirmed ? 'Firestore baseline active' : 'Initial baseline not yet confirmed'}</span>
            {syncStatus.lastSyncAt && <span>Last sync {new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(syncStatus.lastSyncAt))}</span>}
            {syncStatus.lastSyncStatus === 'failed' && <strong>Needs review</strong>}
          </div>
        ) : <p className="lead-import__sync-status" role="status">Loading office sync status…</p>}

        {syncStatus?.lastSyncError && <p className="form-error" role="alert">{syncStatus.lastSyncError}</p>}
        {syncError && <p className="form-error" role="alert">{syncError.message}</p>}
        {syncError && 'invalidRows' in syncError && Array.isArray(syncError.invalidRows) && syncError.invalidRows.length > 0 && (
          <IssueList title="Correct these source rows, then retry sync" items={syncError.invalidRows.map((item) => {
            const issue = item as SheetSyncIssue
            return `${issue.tabName} row ${issue.sourceRow}: ${issue.reason}`
          })} />
        )}
        {syncError && 'invalidTabs' in syncError && Array.isArray(syncError.invalidTabs) && syncError.invalidTabs.length > 0 && (
          <IssueList title="Source tabs needing attention" items={syncError.invalidTabs.map((item) => {
            const issue = item as { tabName: string; reason: string }
            return `${issue.tabName}: ${issue.reason}`
          })} />
        )}
        {syncError && 'duplicates' in syncError && Array.isArray(syncError.duplicates) && syncError.duplicates.length > 0 && (
          <IssueList title="Duplicate source rows skipped" items={syncError.duplicates.map((item) => {
            const duplicate = item as { tabName: string; sourceRow: number }
            return `${duplicate.tabName} row ${duplicate.sourceRow}`
          })} />
        )}

        <div className="lead-import__sync-actions">
          {syncStatus?.baselineConfirmed ? (
            <button className="btn btn--primary" type="button" onClick={() => void handleSyncNow()} disabled={syncAction !== null}>
              {syncAction === 'sync' ? 'Syncing register…' : 'Sync live register now'}
            </button>
          ) : (
            <button className="btn btn--primary" type="button" onClick={() => void handlePreviewBaseline()} disabled={syncAction !== null || !syncStatus}>
              {syncAction === 'preview' ? 'Reading source tabs…' : 'Preview initial baseline'}
            </button>
          )}
          {syncStatus?.lastSyncCounts && <span>{syncStatus.lastSyncCounts.inserted} new · {syncStatus.lastSyncCounts.updated} refreshed · {syncStatus.lastSyncCounts.conflicts} conflicts</span>}
        </div>

        {syncPreview && (
          <div className="lead-import__sync-preview" aria-live="polite">
            <h3>Review baseline before importing</h3>
            <div className="lead-import__stats">
              <div><strong>{syncPreview.counts.inserted}</strong><span>new leads</span></div>
              <div><strong>{syncPreview.counts.updated}</strong><span>matched / refreshed</span></div>
              <div><strong>{syncPreview.counts.duplicates}</strong><span>duplicate rows skipped</span></div>
              <div><strong>{syncPreview.counts.invalid}</strong><span>rows needing correction</span></div>
            </div>
            <p className="lead-import__notice">Nothing has been added yet. Confirming writes valid lead records to Firestore; later syncs will preserve app activity and never delete records missing from a sheet.</p>
            {syncPreview.invalidRows.length > 0 && <IssueList title="Resolve these source rows before confirming" items={syncPreview.invalidRows.map((item) => `${item.tabName} row ${item.sourceRow}: ${item.reason}`)} />}
            {syncPreview.duplicates.length > 0 && <IssueList title="Duplicate rows skipped" items={syncPreview.duplicates.map((item) => `${item.tabName} row ${item.sourceRow}`)} />}
            {syncPreview.conflicts.length > 0 && (
              <>
                <p className="lead-import__notice">Some existing Firestore values differ from the sheet. Baseline confirmation records these for review; resolution actions become available after the baseline is saved.</p>
                <IssueList title="Conflicts to review after confirmation" items={syncPreview.conflicts.map((conflict) => `${conflict.leadId || conflict.recordId} · ${conflict.field}: Firestore “${String(conflict.operationalValue)}” / Sheets “${String(conflict.sourceValue)}”`)} />
              </>
            )}
            <button className="btn btn--primary" type="button" onClick={() => void handleConfirmBaseline()} disabled={syncAction !== null || syncPreview.invalidRows.length > 0}>
              {syncAction === 'confirm' ? 'Confirming baseline…' : `Confirm and import ${syncPreview.counts.inserted} leads`}
            </button>
          </div>
        )}

        {syncConflicts.length > 0 && (
          <section className="lead-import__conflicts" aria-labelledby="lead-import-conflicts-title">
            <h3 id="lead-import-conflicts-title">Source changes need a decision ({syncConflicts.length})</h3>
            <p>Firestore was left unchanged for these fields. Choose which value becomes the shared lead value.</p>
            {syncConflicts.map((conflict) => (
              <article className="lead-import__conflict" key={`${conflict.recordId}-${conflict.field}`}>
                <div><strong>{conflict.leadId || conflict.recordId}</strong><span>{conflict.field.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`)}</span></div>
                <dl>
                  <div><dt>Firestore</dt><dd>{String(conflict.operationalValue)}</dd></div>
                  <div><dt>Google Sheets</dt><dd>{String(conflict.sourceValue)}</dd></div>
                </dl>
                <div className="lead-import__conflict-actions">
                  <button type="button" className="btn btn--secondary" disabled={syncAction !== null} onClick={() => void handleResolveConflict(conflict.recordId, conflict.field as LeadSourceField, 'firestore')}>Keep Firestore</button>
                  <button type="button" className="btn btn--primary" disabled={syncAction !== null} onClick={() => void handleResolveConflict(conflict.recordId, conflict.field as LeadSourceField, 'sheets')}>Use Sheets</button>
                </div>
              </article>
            ))}
          </section>
        )}
      </section>

      <div className="lead-import__controls">
        <label>
          Office
          <select value={officeId} onChange={(event) => handleOfficeChange(event.target.value as OfficeId)}>
            {availableOffices.map((office) => <option key={office} value={office}>{office === 'perth' ? 'Perth' : 'Brisbane'}</option>)}
          </select>
        </label>
        <label className="lead-import__file">
          Workbook (.xlsx)
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
        </label>
      </div>

      {isReading && <p role="status">Reading {fileName}…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {preview && (
        <div className="lead-import__preview" aria-live="polite">
          <h2>Import preview</h2>
          <p className="lead-import__filename">{fileName} · {officeId}</p>
          <div className="lead-import__stats">
            <div><strong>{preview.records.length}</strong><span>valid records</span></div>
            <div><strong>{preview.duplicateCount}</strong><span>duplicates in workbook</span></div>
            <div><strong>{duplicateCount}</strong><span>already on map</span></div>
            <div><strong>{preview.invalidRows.length}</strong><span>invalid rows</span></div>
          </div>
          <p className="lead-import__notice">No records have been written yet. The next step will geocode addresses and add them as contacted pins, keeping them out of the default available-to-knock workflow.</p>
          <button className="btn btn--primary" type="button" onClick={() => void handleImport()} disabled={isImporting || preview.records.length === duplicateCount}>
            {isImporting ? `Importing ${importProgress.done} of ${importProgress.total}…` : 'Start master import'}
          </button>
          {isImporting && <progress value={importProgress.done} max={importProgress.total} aria-label="Import progress" />}
          {importComplete && <p className="lead-import__success" role="status">Import complete. {importProgress.created} records added; {importProgress.skipped} skipped.</p>}
          {importDiagnostics.length > 0 && (
            <section className="lead-import__diagnostics" aria-labelledby="lead-import-diagnostics-title">
              <h3 id="lead-import-diagnostics-title">Rows needing attention</h3>
              <ul>
                {importDiagnostics.map((diagnostic, index) => (
                  <li key={`${diagnostic.sheet}-${diagnostic.row}-${diagnostic.reason}-${index}`}>
                    {diagnostic.sheet} row {diagnostic.row}: {diagnostic.reason}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="lead-import__statuses">
            {Array.from(new Set(preview.records.map((record) => record.sourceStatus))).slice(0, 8).map((status) => <span key={status}>{status}</span>)}
          </div>
        </div>
      )}
    </section>
  )
}

function IssueList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="lead-import__diagnostics">
      <h4>{title}</h4>
      <ul>{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
    </div>
  )
}
