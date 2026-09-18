import { useState, type ChangeEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../auth'
import { canManageUsers } from '../domain/roles'
import { getAllPins, ingestLead, parseLeadWorkbook, findImportedDuplicates, type LeadImportPreview } from '../domain'
import type { OfficeId } from '../domain/roles'
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
    setPreview(null)
    setFileName('')
    setImportDiagnostics([])
  }

  return (
    <section className="lead-import page-card">
      <header className="lead-import__header">
        <div>
          <p className="eyebrow">Administrator tools</p>
          <h1>Import master leads</h1>
          <p>Review the live lead workbook before adding contacted properties to the map.</p>
        </div>
      </header>

      <div className="lead-import__controls">
        <label>
          Office
          <select value={officeId} onChange={(event) => handleOfficeChange(event.target.value as OfficeId)}>
            <option value="perth">Perth</option>
            <option value="brisbane">Brisbane</option>
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
