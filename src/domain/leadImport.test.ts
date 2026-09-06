import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { PinOutcome } from './pinOutcome'
import { normaliseLeadAddress, parseLeadWorkbook } from './leadImport'

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
})
