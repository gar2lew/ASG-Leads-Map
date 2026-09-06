import { useState, type ChangeEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useCurrentUser } from '../auth'
import { canManageUsers } from '../domain/roles'
import { createPin, getAllPins, parseLeadWorkbook, findImportedDuplicates, savePin, searchAddress, type LeadImportPreview } from '../domain'
import type { OfficeId } from '../domain/roles'
import './LeadImportPage.css'

export function LeadImportPage() {
  const user = useCurrentUser()
  const [officeId, setOfficeId] = useState<OfficeId>(user.officeId ?? 'perth')
  const [preview, setPreview] = useState<LeadImportPreview | null>(null)
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0, skipped: 0 })
  const [importComplete, setImportComplete] = useState(false)

  if (!canManageUsers(user.role)) return <Navigate to="/map" replace />

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError(null)
    setPreview(null)
    setImportComplete(false)
    setFileName(file.name)
    setIsReading(true)
    try {
      const parsed = parseLeadWorkbook(await file.arrayBuffer(), officeId)
      const existing = await getAllPins()
      setPreview(parsed)
      setDuplicateCount(findImportedDuplicates(parsed.records, existing).size)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to read this workbook.')
    } finally {
      setIsReading(false)
    }
  }

  async function handleImport() {
    if (!preview || isImporting) return
    const existing = await getAllPins()
    const duplicates = findImportedDuplicates(preview.records, existing)
    const records = preview.records.filter((record) => !duplicates.has(record.dedupeKey))
    setIsImporting(true)
    setImportComplete(false)
    setImportProgress({ done: 0, total: records.length, skipped: preview.records.length - records.length })
    try {
      let skipped = preview.records.length - records.length
      for (let index = 0; index < records.length; index += 1) {
        const record = records[index]
        const results = await searchAddress(record.address)
        const location = results[0]
        if (!location) {
          skipped += 1
          setImportProgress({ done: index + 1, total: records.length, skipped })
          continue
        }
        const pin = createPin({
          latitude: location.latitude,
          longitude: location.longitude,
          outcome: record.outcome,
          address: record.address,
          notes: [record.notes, `Imported from ${record.sourceSheet} (${record.sourceStatus})`].filter(Boolean).join(' · '),
          contactName: record.contactName,
          contactPhone: record.contactPhone,
          contactEmail: undefined,
          officeId,
        }, user.uid, officeId)
        await savePin(pin)
        setImportProgress({ done: index + 1, total: records.length, skipped })
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
          {importComplete && <p className="lead-import__success" role="status">Import complete. {importProgress.done - importProgress.skipped} records added; {importProgress.skipped} skipped.</p>}
          <div className="lead-import__statuses">
            {Array.from(new Set(preview.records.map((record) => record.sourceStatus))).slice(0, 8).map((status) => <span key={status}>{status}</span>)}
          </div>
        </div>
      )}
    </section>
  )
}
