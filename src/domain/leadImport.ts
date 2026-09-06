import * as XLSX from 'xlsx'
import type { Pin } from './pin'
import { PinOutcome } from './pinOutcome'
import type { OfficeId } from './roles'

export interface ImportedLead {
  sourceRow: number
  sourceSheet: string
  officeId: OfficeId
  leadId?: string
  address: string
  contactName?: string
  contactPhone?: string
  notes?: string
  sourceStatus: string
  outcome: PinOutcome
  dedupeKey: string
}

export interface LeadImportPreview {
  records: ImportedLead[]
  invalidRows: Array<{ sheet: string; row: number; reason: string }>
  duplicateCount: number
}

const STATUS_OUTCOMES: Array<[RegExp, PinOutcome]> = [
  [/wrong\s*number/i, PinOutcome.WrongNumber],
  [/not\s*interested/i, PinOutcome.NotInterested],
  [/revisit/i, PinOutcome.Revisit],
  [/lead|booked/i, PinOutcome.Lead],
  [/no\s*answer|not\s*knocked/i, PinOutcome.NotKnocked],
]

function text(value: unknown): string {
  return value == null ? '' : String(value).trim()
}

export function normaliseLeadAddress(address: string): string {
  return address.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function outcomeFromLeadStatus(status: string, sheetName: string): PinOutcome {
  const source = `${status} ${sheetName}`
  return STATUS_OUTCOMES.find(([pattern]) => pattern.test(source))?.[1] ?? PinOutcome.NotKnocked
}

export function parseLeadWorkbook(data: ArrayBuffer, officeId: OfficeId): LeadImportPreview {
  const workbook = XLSX.read(data, { type: 'array', cellDates: true })
  const records: ImportedLead[] = []
  const invalidRows: LeadImportPreview['invalidRows'] = []
  const seen = new Set<string>()
  let duplicateCount = 0

  for (const sheetName of workbook.SheetNames) {
    if (!['LEADS', 'NO ANSWER', 'REVISIT', 'NOT INTERESTED', 'WRONG NUMBER', 'BOOKED'].includes(sheetName.toUpperCase())) continue
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
    rows.forEach((row, index) => {
      const address = text(row['Address'])
      if (!address) {
        invalidRows.push({ sheet: sheetName, row: index + 2, reason: 'Missing address' })
        return
      }
      const sourceStatus = text(row['Lead Status']) || sheetName
      const dedupeKey = text(row['LeadID']) || normaliseLeadAddress(address)
      if (seen.has(dedupeKey)) {
        duplicateCount += 1
        return
      }
      seen.add(dedupeKey)
      records.push({
        sourceRow: index + 2,
        sourceSheet: sheetName,
        officeId,
        ...(text(row['LeadID']) ? { leadId: text(row['LeadID']) } : {}),
        address,
        ...(text(row['Lead Name']) ? { contactName: text(row['Lead Name']) } : {}),
        ...(text(row['Contact Number']) ? { contactPhone: text(row['Contact Number']) } : {}),
        ...(text(row['Notes']) ? { notes: text(row['Notes']) } : {}),
        sourceStatus,
        outcome: outcomeFromLeadStatus(sourceStatus, sheetName),
        dedupeKey,
      })
    })
  }

  return { records, invalidRows, duplicateCount }
}

export function findImportedDuplicates(records: ImportedLead[], existingPins: Pin[]): Set<string> {
  const existing = new Set(existingPins.map((pin) => normaliseLeadAddress(pin.address ?? '')))
  return new Set(records.filter((record) => existing.has(record.dedupeKey)).map((record) => record.dedupeKey))
}
