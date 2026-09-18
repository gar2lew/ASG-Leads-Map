import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { PinOutcome } from './pinOutcome'
import type { Pin } from './pin'
import { findImportedDuplicates, normaliseLeadAddress, parseLeadWorkbook } from './leadImport'

describe('lead workbook import', () => {
  it('reads supported tabs, maps statuses, and removes duplicate lead IDs', () => {
    const workbook = XLSX.utils.book_new()
    const rows = [
      { Address: '1 Example Street, Baldivis WA', 'Lead Name': 'Alex', 'Lead Status': 'Lead', LeadID: 'A1' },
      { Address: '1 Example Street, Baldivis WA', 'Lead Name': 'Alex', 'Lead Status': 'Lead', LeadID: 'A1' },
    ]
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'LEADS')
    const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })

    const result = parseLeadWorkbook(data, 'perth')

    expect(result.records).toHaveLength(1)
    expect(result.records[0]?.outcome).toBe(PinOutcome.Lead)
    expect(result.records[0]?.officeId).toBe('perth')
    expect(result.duplicateCount).toBe(1)
  })

  it('normalises addresses for deduplication', () => {
    expect(normaliseLeadAddress('10/2 King St, Bentley WA')).toBe('10 2 king st bentley wa')
  })

  it('keeps valid rows and reports contact validation diagnostics for invalid rows', () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      { Address: '1 Example Street, Baldivis WA', 'Lead Name': 'Alex', LeadID: 'A1' },
      { Address: '2 Example Street, Baldivis WA', LeadID: 'A2' },
      { Address: '3 Example Street, Baldivis WA', 'Contact Number': '12345', LeadID: 'A3' },
    ]), 'LEADS')
    const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })

    const result = parseLeadWorkbook(data, 'perth')

    expect(result.records.map((record) => record.leadId)).toEqual(['A1'])
    expect(result.invalidRows).toEqual([
      { sheet: 'LEADS', row: 3, reason: 'At least one contact detail is required' },
      { sheet: 'LEADS', row: 4, reason: 'Enter a valid Australian phone number' },
    ])
  })

  it('matches existing pins by normalized address or Jotform external ID', () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      { Address: '10 EXAMPLE STREET, Perth WA 6000', 'Lead Name': 'Address match', LeadID: 'new-id' },
      { Address: '99 Different Road, Perth WA 6000', 'Lead Name': 'ID match', LeadID: 'existing-id' },
      { Address: '20 Unique Street, Perth WA 6000', 'Lead Name': 'Unique', LeadID: 'unique-id' },
    ]), 'LEADS')
    const data = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const parsed = parseLeadWorkbook(data, 'perth')
    const existingPins = [
      { address: '10 Example Street Perth WA 6000' },
      { address: '1 Elsewhere Avenue', source: 'jotform', externalId: 'existing-id' },
    ] as Pin[]

    expect(findImportedDuplicates(parsed.records, existingPins)).toEqual(new Set(['new-id', 'existing-id']))
  })
})
