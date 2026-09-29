import { describe, expect, it } from 'vitest'
import { migrateLeadRecord, type LeadRecord } from './leadRegister'
import { parseSheetTabRows, reconcileSheetRows, type SheetLeadRow } from './sheetsReconciliation'

function sheetRow(overrides: Partial<SheetLeadRow> = {}): SheetLeadRow {
  return {
    office: 'perth', spreadsheetId: 'perth-sheet', tabName: 'LEADS', sourceRow: 2, lastSeenAt: '2026-09-29T15:00:00.000Z',
    leadId: 'L-1', fields: { leadName: 'Ava Smith', address: '1 Main Street', phone: '0412 345 678', leadStatus: 'New' },
    ...overrides,
  }
}

function currentLead(overrides: Partial<LeadRecord> = {}): LeadRecord {
  return migrateLeadRecord({
    id: 'lead-perth-L-1', office: 'perth', leadId: 'L-1', leadName: 'Ava Smith', address: '1 Main Street',
    phone: '', notes: '', leadStatus: 'New', ...overrides,
  })
}

describe('Google Sheets reconciliation', () => {
  it('parses source tab headers while preserving tab and spreadsheet row provenance', () => {
    const parsed = parseSheetTabRows({
      office: 'perth', spreadsheetId: 'perth-sheet', tabName: 'BOOKED', lastSeenAt: '2026-09-29T15:00:00.000Z',
      values: [['Date', 'Lead Name', 'Address', 'Contact Number', 'LeadID'], ['29/09/2026', 'Ava Smith', '1 Main Street', '0412 345 678', 'L-1']],
    })

    expect(parsed.rows).toEqual([expect.objectContaining({
      office: 'perth', tabName: 'BOOKED', sourceRow: 2, leadId: 'L-1',
      fields: { date: '29/09/2026', leadName: 'Ava Smith', address: '1 Main Street', phone: '0412 345 678', leadStatus: 'Booked' },
    })])
    expect(parsed.error).toBeUndefined()
  })

  it('rejects malformed tab headers without implying source deletions', () => {
    const parsed = parseSheetTabRows({
      office: 'brisbane', spreadsheetId: 'brisbane-sheet', tabName: 'LEADS', lastSeenAt: '2026-09-29T15:00:00.000Z',
      values: [['Wrong header'], ['untrusted data']],
    })

    expect(parsed.rows).toEqual([])
    expect(parsed.error).toMatch(/header/i)
  })

  it('proposes new leads without mutating current records', () => {
    const current = currentLead({ id: 'other', leadId: 'L-2', address: '99 Other Road', leadName: 'Someone Else' })
    const preview = reconcileSheetRows({ rows: [sheetRow()], currentRecords: [current] })

    expect(preview.inserts).toHaveLength(1)
    expect(preview.inserts[0]).toMatchObject({ office: 'perth', leadId: 'L-1', leadName: 'Ava Smith', address: '1 Main Street' })
    expect(preview.inserts[0]?.source).toMatchObject({ spreadsheetId: 'perth-sheet', tabName: 'LEADS', sourceRow: 2 })
    expect(preview.updates).toHaveLength(0)
    expect(current.leadId).toBe('L-2')
  })

  it('refreshes unchanged app fields and reports app-edited fields as conflicts', () => {
    const previous = reconcileSheetRows({ rows: [sheetRow({ fields: { leadName: 'Ava Smith', address: '1 Main Street', phone: '0400 000 000' } })], currentRecords: [] }).inserts[0]
    const existing = { ...previous!, leadName: 'Ava at home', phone: '0499 999 999' }
    const preview = reconcileSheetRows({ rows: [sheetRow({ fields: { leadName: 'Ava S.', address: '1 Main Street updated', phone: '0412 345 678' } })], currentRecords: [existing] })

    expect(preview.updates).toHaveLength(1)
    expect(preview.updates[0]).toMatchObject({ leadName: 'Ava at home', address: '1 Main Street updated', phone: '0499 999 999' })
    expect(preview.conflicts).toEqual([{ leadId: 'L-1', recordId: 'sheet-perth-L-1', field: 'leadName', sourceValue: 'Ava S.', operationalValue: 'Ava at home' }, { leadId: 'L-1', recordId: 'sheet-perth-L-1', field: 'phone', sourceValue: '0412 345 678', operationalValue: '0499 999 999' }])
  })

  it('does not treat rows missing from Sheets as deletions', () => {
    const existing = currentLead()
    const preview = reconcileSheetRows({ rows: [], currentRecords: [existing] })

    expect(preview.inserts).toHaveLength(0)
    expect(preview.updates).toHaveLength(0)
    expect(preview.unchanged).toHaveLength(0)
    expect(preview.deletions).toEqual([])
  })

  it('skips malformed rows and duplicate identities without producing writes', () => {
    const preview = reconcileSheetRows({
      rows: [sheetRow({ fields: { leadName: 'Ava Smith', address: '' } }), sheetRow(), sheetRow({ sourceRow: 3 })],
      currentRecords: [],
    })

    expect(preview.invalidRows).toHaveLength(1)
    expect(preview.duplicates).toHaveLength(1)
    expect(preview.inserts).toHaveLength(1)
  })

  it('uses office in the identity so matching LeadIDs from different offices stay separate', () => {
    const preview = reconcileSheetRows({
      rows: [sheetRow({ office: 'brisbane', spreadsheetId: 'brisbane-sheet' })],
      currentRecords: [currentLead()],
    })

    expect(preview.inserts).toHaveLength(1)
    expect(preview.updates).toHaveLength(0)
  })

  it('reuses the same source identity for rows that do not have a LeadID', () => {
    const row = sheetRow({ leadId: undefined })
    const first = reconcileSheetRows({ rows: [row], currentRecords: [] })
    const second = reconcileSheetRows({ rows: [{ ...row, lastSeenAt: '2026-09-30T15:00:00.000Z' }], currentRecords: first.inserts })

    expect(first.inserts).toHaveLength(1)
    expect(second.inserts).toHaveLength(0)
    expect(second.updates).toHaveLength(0)
    expect(second.unchanged[0]?.id).toBe(first.inserts[0]?.id)
  })

  it('matches an un-sourced Firestore lead by a unique address and name when Sheets has no LeadID', () => {
    const row = sheetRow({ leadId: undefined })
    const existing = currentLead({ id: 'app-generated-id', leadId: 'app-generated-id' })
    const preview = reconcileSheetRows({ rows: [row], currentRecords: [existing] })

    expect(preview.inserts).toHaveLength(0)
    expect(preview.updates[0]?.id).toBe('app-generated-id')
  })

  it('attaches a newly added LeadID to an existing unique name/address source record', () => {
    const original = reconcileSheetRows({ rows: [sheetRow({ leadId: undefined })], currentRecords: [] }).inserts[0]
    const preview = reconcileSheetRows({ rows: [sheetRow()], currentRecords: [original!] })

    expect(preview.inserts).toHaveLength(0)
    expect(preview.updates[0]?.id).toBe(original?.id)
    expect(preview.updates[0]?.source?.leadId).toBe('L-1')
  })

  it('flags same-address rows when LeadID coverage is mixed across source tabs', () => {
    const preview = reconcileSheetRows({
      rows: [sheetRow({ leadId: undefined }), sheetRow({ tabName: 'BOOKED', sourceRow: 4 })],
      currentRecords: [],
    })

    expect(preview.inserts).toHaveLength(1)
    expect(preview.invalidRows[0]?.reason).toMatch(/missing or conflicting LeadIDs/i)
    expect(preview.duplicates).toHaveLength(1)
  })

  it('blocks a changed LeadID that would otherwise fork an existing address/name lead', () => {
    const existing = currentLead({ leadId: 'L-1' })
    const preview = reconcileSheetRows({ rows: [sheetRow({ leadId: 'L-2' })], currentRecords: [existing] })

    expect(preview.inserts).toHaveLength(0)
    expect(preview.updates).toHaveLength(0)
    expect(preview.invalidRows[0]?.reason).toMatch(/different source LeadID/i)
  })

  it('blocks duplicate source LeadIDs with conflicting values across tabs', () => {
    const preview = reconcileSheetRows({
      rows: [sheetRow(), sheetRow({ tabName: 'BOOKED', sourceRow: 5, fields: { ...sheetRow().fields, leadStatus: 'Booked' } })],
      currentRecords: [],
    })

    expect(preview.inserts).toHaveLength(1)
    expect(preview.invalidRows[0]?.reason).toMatch(/duplicate source LeadIDs contain conflicting/i)
  })

  it('treats identical duplicate source rows as equal regardless of column order', () => {
    const preview = reconcileSheetRows({
      rows: [
        sheetRow(),
        sheetRow({ tabName: 'BOOKED', sourceRow: 5, fields: { leadStatus: 'New', phone: '0412 345 678', address: '1 Main Street', leadName: 'Ava Smith' } }),
      ],
      currentRecords: [],
    })

    expect(preview.duplicates).toHaveLength(1)
    expect(preview.invalidRows).toHaveLength(0)
  })

  it('flags a deterministic document ID collision instead of proposing an overwrite', () => {
    const row = sheetRow()
    const unrelated = currentLead({ id: 'sheet-perth-L-1', leadId: 'unrelated', address: '99 Other Road', leadName: 'Someone Else' })
    const preview = reconcileSheetRows({ rows: [row], currentRecords: [unrelated] })

    expect(preview.inserts).toHaveLength(0)
    expect(preview.invalidRows[0]?.reason).toMatch(/document id collision/i)
  })

  it('excludes invalid source dates, timestamps, and Australian phone numbers from snapshots', () => {
    const preview = reconcileSheetRows({
      rows: [sheetRow({ fields: { leadName: 'Ava Smith', address: '1 Main Street', date: '31/02/2026', callTimestamp: 'not a time', phone: '123' } })],
      currentRecords: [],
    })

    expect(preview.inserts[0]?.source?.snapshot).not.toHaveProperty('date')
    expect(preview.inserts[0]?.source?.snapshot).not.toHaveProperty('callTimestamp')
    expect(preview.inserts[0]?.source?.snapshot).not.toHaveProperty('phone')
  })
})
